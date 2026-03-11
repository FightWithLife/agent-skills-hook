#[allow(unused_imports)]
use super::{
    adapt_request_for_protocol, adapt_upstream_response,
    adapt_upstream_response_with_tool_name_restore_map, ResponseAdapter,
};
use crate::apikey_profile::PROTOCOL_ANTHROPIC_NATIVE;

#[test]
fn anthropic_json_response_maps_reasoning_item_to_thinking_block() {
    let upstream = serde_json::json!({
        "id": "resp_reasoning_1",
        "object": "response",
        "created": 1700001200,
        "model": "gpt-5.3-codex",
        "output": [
            {
                "type": "reasoning",
                "id": "rs_1",
                "summary": [{"type": "summary_text", "text": "先检查配置，再执行。"}],
                "encrypted_content": "sig_reasoning_1"
            },
            {
                "type": "message",
                "content": [{"type": "output_text", "text": "已经处理完成。"}]
            }
        ],
        "usage": {"input_tokens": 12, "output_tokens": 6, "total_tokens": 18}
    });
    let (body, content_type) = adapt_upstream_response(
        ResponseAdapter::AnthropicJson,
        Some("application/json"),
        &serde_json::to_vec(&upstream).expect("serialize upstream"),
    )
    .expect("convert response");
    let value: serde_json::Value = serde_json::from_slice(&body).expect("parse converted body");
    assert_eq!(content_type, "application/json");
    assert_eq!(
        value
            .get("content")
            .and_then(|content| content.get(0))
            .and_then(|block| block.get("type"))
            .and_then(serde_json::Value::as_str),
        Some("thinking")
    );
    assert_eq!(
        value
            .get("content")
            .and_then(|content| content.get(0))
            .and_then(|block| block.get("thinking"))
            .and_then(serde_json::Value::as_str),
        Some("先检查配置，再执行。")
    );
    assert_eq!(
        value
            .get("content")
            .and_then(|content| content.get(0))
            .and_then(|block| block.get("signature"))
            .and_then(serde_json::Value::as_str),
        Some("sig_reasoning_1")
    );
}

#[test]
fn anthropic_sse_response_maps_reasoning_deltas_to_thinking_events() {
    let upstream = r#"data: {"type":"response.output_item.added","output_index":0,"item":{"type":"reasoning","id":"rs_stream_1","summary":[]}}

data: {"type":"response.reasoning_summary_text.delta","output_index":0,"summary_index":0,"delta":"先读配置"}

data: {"type":"response.output_item.done","output_index":0,"item":{"type":"reasoning","id":"rs_stream_1","summary":[{"type":"summary_text","text":"先读配置"}],"encrypted_content":"sig_stream_1"}}

data: [DONE]

"#;
    let (body, content_type) = adapt_upstream_response(
        ResponseAdapter::AnthropicSse,
        Some("text/event-stream"),
        upstream.as_bytes(),
    )
    .expect("convert response");
    let text = String::from_utf8(body).expect("parse sse body");
    assert_eq!(content_type, "text/event-stream");
    assert!(text.contains("\"type\":\"thinking_delta\""));
    assert!(text.contains("\"thinking\":\"先读配置\""));
    assert!(text.contains("\"type\":\"signature_delta\""));
    assert!(text.contains("\"signature\":\"sig_stream_1\""));
}

#[test]
fn anthropic_json_response_from_sse_preserves_thinking_block() {
    let upstream = r#"data: {"type":"response.output_item.added","output_index":0,"item":{"type":"reasoning","id":"rs_stream_json_1","summary":[]}}

data: {"type":"response.reasoning_text.delta","output_index":0,"content_index":0,"delta":"逐步分析"}

data: {"type":"response.output_item.done","output_index":0,"item":{"type":"reasoning","id":"rs_stream_json_1","summary":[],"encrypted_content":"sig_stream_json_1"}}

data: [DONE]

"#;
    let (body, content_type) = adapt_upstream_response(
        ResponseAdapter::AnthropicJson,
        Some("text/event-stream"),
        upstream.as_bytes(),
    )
    .expect("convert response");
    let value: serde_json::Value = serde_json::from_slice(&body).expect("parse converted body");
    assert_eq!(content_type, "application/json");
    assert_eq!(
        value
            .get("content")
            .and_then(|content| content.get(0))
            .and_then(|block| block.get("type"))
            .and_then(serde_json::Value::as_str),
        Some("thinking")
    );
    assert_eq!(
        value
            .get("content")
            .and_then(|content| content.get(0))
            .and_then(|block| block.get("thinking"))
            .and_then(serde_json::Value::as_str),
        Some("逐步分析")
    );
    assert_eq!(
        value
            .get("content")
            .and_then(|content| content.get(0))
            .and_then(|block| block.get("signature"))
            .and_then(serde_json::Value::as_str),
        Some("sig_stream_json_1")
    );
}

#[test]
fn anthropic_chat_completions_still_passthrough() {
    let body =
        br#"{"model":"gpt-5.3-codex","messages":[{"role":"user","content":"hello"}]}"#.to_vec();
    let adapted = adapt_request_for_protocol(
        PROTOCOL_ANTHROPIC_NATIVE,
        "/v1/chat/completions",
        body.clone(),
    )
    .expect("adapt request");
    assert_eq!(adapted.path, "/v1/chat/completions");
    assert_eq!(adapted.body, body);
    assert_eq!(adapted.response_adapter, ResponseAdapter::Passthrough);
}

#[test]
fn anthropic_json_response_restores_shortened_tool_name() {
    let original_tool_name =
        "mcp__plugin_super_long_workspace_namespace__tool_server_namespace_for_codex_manager_gateway_adapter_alignment__very_long_tool_operation_name";
    let request = serde_json::json!({
        "model": "claude-sonnet-4-5",
        "messages": [{ "role": "user", "content": "hi" }],
        "tools": [{
            "name": original_tool_name,
            "description": "long tool",
            "input_schema": { "type": "object", "properties": {} }
        }]
    });
    let adapted = adapt_request_for_protocol(
        PROTOCOL_ANTHROPIC_NATIVE,
        "/v1/messages",
        serde_json::to_vec(&request).expect("serialize request"),
    )
    .expect("adapt request");
    let adapted_value: serde_json::Value =
        serde_json::from_slice(&adapted.body).expect("parse adapted body");
    let shortened_name = adapted_value
        .get("tools")
        .and_then(|tools| tools.get(0))
        .and_then(|tool| tool.get("name"))
        .and_then(serde_json::Value::as_str)
        .expect("tools[0].name");
    let upstream = serde_json::json!({
        "id": "resp_restore_1",
        "object": "response",
        "created": 1700001000,
        "model": "gpt-5.3-codex",
        "output": [{
            "type": "function_call",
            "call_id": "call_restore_1",
            "name": shortened_name,
            "arguments": "{}"
        }]
    });
    let upstream_body = serde_json::to_vec(&upstream).expect("serialize upstream");
    let (body, content_type) = adapt_upstream_response_with_tool_name_restore_map(
        ResponseAdapter::AnthropicJson,
        Some("application/json"),
        &upstream_body,
        Some(&adapted.tool_name_restore_map),
    )
    .expect("convert response");
    let value: serde_json::Value = serde_json::from_slice(&body).expect("parse converted body");
    assert_eq!(content_type, "application/json");
    assert_eq!(
        value
            .get("content")
            .and_then(|content| content.get(0))
            .and_then(|block| block.get("name"))
            .and_then(serde_json::Value::as_str),
        Some(original_tool_name)
    );
}

#[test]
fn anthropic_json_response_maps_custom_tool_call_to_tool_use() {
    let upstream = serde_json::json!({
        "id": "resp_custom_tool_anthropic_1",
        "object": "response",
        "created": 1700001201,
        "model": "gpt-5.3-codex",
        "output": [{
            "type": "custom_tool_call",
            "call_id": "call_exec_1",
            "name": "exec",
            "input": "{\"cmd\":\"pwd\"}"
        }],
        "usage": {"input_tokens": 4, "output_tokens": 2, "total_tokens": 6}
    });
    let (body, content_type) = adapt_upstream_response(
        ResponseAdapter::AnthropicJson,
        Some("application/json"),
        &serde_json::to_vec(&upstream).expect("serialize upstream"),
    )
    .expect("convert response");
    let value: serde_json::Value = serde_json::from_slice(&body).expect("parse converted body");
    assert_eq!(content_type, "application/json");
    assert_eq!(value["content"][0]["type"], "tool_use");
    assert_eq!(value["content"][0]["id"], "call_exec_1");
    assert_eq!(value["content"][0]["name"], "exec");
    assert_eq!(value["content"][0]["input"]["cmd"], "pwd");
    assert_eq!(value["stop_reason"], "tool_use");
}

#[test]
fn anthropic_json_response_maps_cache_usage_fields() {
    let upstream = serde_json::json!({
        "id": "resp_usage_cache_1",
        "object": "response",
        "created": 1700001305,
        "model": "gpt-5.3-codex",
        "output": [{
            "type": "message",
            "content": [{"type": "output_text", "text": "ok"}]
        }],
        "usage": {
            "input_tokens": 21,
            "output_tokens": 5,
            "total_tokens": 26,
            "cache_creation_input_tokens": 7,
            "input_tokens_details": {
                "cached_tokens": 9
            }
        }
    });
    let (body, content_type) = adapt_upstream_response(
        ResponseAdapter::AnthropicJson,
        Some("application/json"),
        &serde_json::to_vec(&upstream).expect("serialize upstream"),
    )
    .expect("convert response");
    let value: serde_json::Value = serde_json::from_slice(&body).expect("parse converted body");
    assert_eq!(content_type, "application/json");
    assert_eq!(value["usage"]["input_tokens"], 21);
    assert_eq!(value["usage"]["output_tokens"], 5);
    assert_eq!(value["usage"]["cache_creation_input_tokens"], 7);
    assert_eq!(value["usage"]["cache_read_input_tokens"], 9);
}

#[test]
fn anthropic_json_response_maps_web_search_call_to_text_block() {
    let upstream = serde_json::json!({
        "id": "resp_web_search_anthropic_1",
        "object": "response",
        "created": 1700001202,
        "model": "gpt-5.3-codex",
        "output": [{
            "type": "web_search_call",
            "id": "ws_1",
            "status": "completed",
            "action": { "type": "search", "query": "weather seattle" }
        }],
        "usage": {"input_tokens": 4, "output_tokens": 2, "total_tokens": 6}
    });
    let (body, content_type) = adapt_upstream_response(
        ResponseAdapter::AnthropicJson,
        Some("application/json"),
        &serde_json::to_vec(&upstream).expect("serialize upstream"),
    )
    .expect("convert response");
    let value: serde_json::Value = serde_json::from_slice(&body).expect("parse converted body");
    assert_eq!(content_type, "application/json");
    assert_eq!(value["content"][0]["type"], "text");
    assert_eq!(
        value["content"][0]["text"],
        "[web_search_call] status=completed query=weather seattle"
    );
}

#[test]
fn anthropic_json_response_maps_image_generation_call_to_text_block() {
    let upstream = serde_json::json!({
        "id": "resp_image_anthropic_1",
        "object": "response",
        "created": 1700001203,
        "model": "gpt-5.3-codex",
        "output": [{
            "type": "image_generation_call",
            "id": "ig_1",
            "status": "completed",
            "revised_prompt": "A small blue square",
            "result": "Zm9v"
        }],
        "usage": {"input_tokens": 4, "output_tokens": 2, "total_tokens": 6}
    });
    let (body, content_type) = adapt_upstream_response(
        ResponseAdapter::AnthropicJson,
        Some("application/json"),
        &serde_json::to_vec(&upstream).expect("serialize upstream"),
    )
    .expect("convert response");
    let value: serde_json::Value = serde_json::from_slice(&body).expect("parse converted body");
    assert_eq!(content_type, "application/json");
    assert_eq!(value["content"][0]["type"], "text");
    assert_eq!(
        value["content"][0]["text"],
        "[image_generation_call] status=completed prompt=A small blue square result_bytes=4"
    );
}

#[test]
fn anthropic_json_response_maps_local_shell_call_to_text_block() {
    let upstream = serde_json::json!({
        "id": "resp_shell_anthropic_1",
        "object": "response",
        "created": 1700001204,
        "model": "gpt-5.3-codex",
        "output": [{
            "type": "local_shell_call",
            "call_id": "shell_1",
            "status": "completed",
            "action": {
                "type": "exec",
                "command": ["/bin/echo", "hello"],
                "working_directory": "/tmp"
            }
        }],
        "usage": {"input_tokens": 4, "output_tokens": 2, "total_tokens": 6}
    });
    let (body, content_type) = adapt_upstream_response(
        ResponseAdapter::AnthropicJson,
        Some("application/json"),
        &serde_json::to_vec(&upstream).expect("serialize upstream"),
    )
    .expect("convert response");
    let value: serde_json::Value = serde_json::from_slice(&body).expect("parse converted body");
    assert_eq!(content_type, "application/json");
    assert_eq!(value["content"][0]["type"], "text");
    assert_eq!(
        value["content"][0]["text"],
        "[local_shell_call] status=completed command=/bin/echo hello cwd=/tmp"
    );
}

#[test]
fn anthropic_json_response_maps_custom_tool_call_output_to_text_block() {
    let upstream = serde_json::json!({
        "id": "resp_custom_tool_output_anthropic_1",
        "object": "response",
        "created": 1700001205,
        "model": "gpt-5.3-codex",
        "output": [{
            "type": "custom_tool_call_output",
            "call_id": "call_exec_1",
            "output": "command finished"
        }],
        "usage": {"input_tokens": 4, "output_tokens": 2, "total_tokens": 6}
    });
    let (body, content_type) = adapt_upstream_response(
        ResponseAdapter::AnthropicJson,
        Some("application/json"),
        &serde_json::to_vec(&upstream).expect("serialize upstream"),
    )
    .expect("convert response");
    let value: serde_json::Value = serde_json::from_slice(&body).expect("parse converted body");
    assert_eq!(content_type, "application/json");
    assert_eq!(value["content"][0]["type"], "text");
    assert_eq!(value["content"][0]["text"], "command finished");
}

#[test]
fn anthropic_sse_response_maps_custom_tool_call_to_tool_use_events() {
    let upstream = r#"data: {"type":"response.output_item.done","response_id":"resp_custom_tool_stream_1","created":1700001300,"model":"gpt-5.3-codex","output_index":0,"item":{"type":"custom_tool_call","call_id":"call_exec_stream_1","name":"exec","input":"{\"cmd\":\"pwd\"}"}}

data: [DONE]

"#;
    let (body, content_type) = adapt_upstream_response(
        ResponseAdapter::AnthropicSse,
        Some("text/event-stream"),
        upstream.as_bytes(),
    )
    .expect("convert response");
    let text = String::from_utf8(body).expect("parse sse body");
    assert_eq!(content_type, "text/event-stream");
    assert!(text.contains("\"type\":\"tool_use\""));
    assert!(text.contains("\"id\":\"call_exec_stream_1\""));
    assert!(text.contains("\"name\":\"exec\""));
    assert!(text.contains("\"partial_json\":\"{\\\"cmd\\\":\\\"pwd\\\"}\""));
}

#[test]
fn anthropic_sse_response_maps_web_search_call_to_text_events() {
    let upstream = r#"data: {"type":"response.output_item.done","response_id":"resp_web_search_stream_1","created":1700001301,"model":"gpt-5.3-codex","output_index":0,"item":{"type":"web_search_call","id":"ws_1","status":"completed","action":{"type":"search","query":"weather seattle"}}}

data: [DONE]

"#;
    let (body, content_type) = adapt_upstream_response(
        ResponseAdapter::AnthropicSse,
        Some("text/event-stream"),
        upstream.as_bytes(),
    )
    .expect("convert response");
    let text = String::from_utf8(body).expect("parse sse body");
    assert_eq!(content_type, "text/event-stream");
    assert!(text.contains("\"type\":\"text_delta\""));
    assert!(text.contains("[web_search_call] status=completed query=weather seattle"));
}

#[test]
fn anthropic_sse_response_restores_shortened_tool_name() {
    let mut restore_map = super::ToolNameRestoreMap::new();
    restore_map.insert(
        "mcp__very_long_tool_operation_name".to_string(),
        "mcp__plugin_super_long_workspace_namespace__tool_server_namespace_for_codex_manager_gateway_adapter_alignment__very_long_tool_operation_name"
            .to_string(),
    );
    let upstream = r#"data: {"type":"response.output_item.added","response_id":"resp_stream_restore_1","created":1700001100,"model":"gpt-5.3-codex","output_index":0,"item":{"type":"function_call","call_id":"call_restore_stream_1","name":"mcp__very_long_tool_operation_name"}}

data: {"type":"response.output_item.done","response_id":"resp_stream_restore_1","created":1700001100,"model":"gpt-5.3-codex","output_index":0,"item":{"type":"function_call","call_id":"call_restore_stream_1","name":"mcp__very_long_tool_operation_name","arguments":"{}"}}

data: {"type":"response.completed","response":{"id":"resp_stream_restore_1","model":"gpt-5.3-codex","usage":{"input_tokens":3,"output_tokens":2}}}

data: [DONE]

"#;
    let (body, content_type) = adapt_upstream_response_with_tool_name_restore_map(
        ResponseAdapter::AnthropicSse,
        Some("text/event-stream"),
        upstream.as_bytes(),
        Some(&restore_map),
    )
    .expect("convert response");
    let text = String::from_utf8(body).expect("parse sse body");
    assert_eq!(content_type, "text/event-stream");
    assert!(text.contains("mcp__plugin_super_long_workspace_namespace__tool_server_namespace_for_codex_manager_gateway_adapter_alignment__very_long_tool_operation_name"));
}

#[test]
fn anthropic_sse_response_maps_cache_usage_fields() {
    let upstream = r#"data: {"type":"response.output_text.delta","delta":"hello"}

data: {"type":"response.completed","response":{"id":"resp_usage_stream_1","model":"gpt-5.3-codex","output":[{"type":"message","content":[{"type":"output_text","text":"hello"}]}],"usage":{"input_tokens":11,"output_tokens":3,"cache_creation_input_tokens":4,"input_tokens_details":{"cached_tokens":6}}}}

data: [DONE]

"#;
    let (body, content_type) = adapt_upstream_response(
        ResponseAdapter::AnthropicSse,
        Some("text/event-stream"),
        upstream.as_bytes(),
    )
    .expect("convert response");
    let text = String::from_utf8(body).expect("parse sse body");
    assert_eq!(content_type, "text/event-stream");
    assert!(text.contains("\"cache_creation_input_tokens\":4"));
    assert!(text.contains("\"cache_read_input_tokens\":6"));
    assert!(text.contains("\"input_tokens\":11"));
    assert!(text.contains("\"output_tokens\":3"));
}
