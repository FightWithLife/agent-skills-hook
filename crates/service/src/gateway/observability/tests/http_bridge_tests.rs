use super::{
    apply_openai_stream_meta_defaults, collect_non_stream_json_from_sse_bytes,
    extract_openai_completed_output_text, inspect_sse_frame, normalize_chat_chunk_delta_role,
    parse_sse_frame_json, parse_usage_from_json, parse_usage_from_sse_frame,
    should_skip_chat_live_text_event, should_skip_completion_live_text_event,
    synthesize_chat_completion_sse_from_json, synthesize_completions_sse_from_json,
    OpenAIChatCompletionsSseReader, OpenAICompletionsSseReader, OpenAIStreamMeta,
    PassthroughSseCollector, PassthroughSseUsageReader, SseKeepAliveFrame,
};
use serde_json::json;
use std::io::{Read, Write};
use std::net::TcpListener;
use std::sync::{Arc, Mutex, MutexGuard};
use std::thread;
use std::time::Duration;

static TEST_ENV_MUTEX: Mutex<()> = Mutex::new(());

fn test_env_guard() -> MutexGuard<'static, ()> {
    TEST_ENV_MUTEX
        .lock()
        .expect("lock http bridge test env mutex")
}

struct EnvGuard {
    key: &'static str,
    original: Option<std::ffi::OsString>,
}

impl EnvGuard {
    fn set(key: &'static str, value: &str) -> Self {
        let original = std::env::var_os(key);
        std::env::set_var(key, value);
        Self { key, original }
    }
}

impl Drop for EnvGuard {
    fn drop(&mut self) {
        if let Some(value) = &self.original {
            std::env::set_var(self.key, value);
        } else {
            std::env::remove_var(self.key);
        }
    }
}

fn open_mock_http_response(content_type: &str, body: &str) -> reqwest::blocking::Response {
    let listener = TcpListener::bind("127.0.0.1:0").expect("bind mock upstream");
    let addr = listener.local_addr().expect("mock upstream addr");
    let content_type = content_type.to_string();
    let body = body.to_string();
    let server = thread::spawn(move || {
        let (mut stream, _) = listener.accept().expect("accept mock client");
        let mut request_buf = [0_u8; 2048];
        let _ = stream.read(&mut request_buf);
        let response = format!(
            "HTTP/1.1 200 OK\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
            body.as_bytes().len()
        );
        stream
            .write_all(response.as_bytes())
            .expect("write mock response");
        stream.flush().expect("flush mock response");
    });
    let response = reqwest::blocking::get(format!("http://{addr}")).expect("request mock upstream");
    server.join().expect("join mock upstream server");
    response
}

fn open_streaming_mock_http_response(
    content_type: &str,
    chunks: &[(&str, u64)],
) -> (reqwest::blocking::Response, thread::JoinHandle<()>) {
    let listener = TcpListener::bind("127.0.0.1:0").expect("bind streaming mock upstream");
    let addr = listener.local_addr().expect("streaming mock upstream addr");
    let content_type = content_type.to_string();
    let chunks = chunks
        .iter()
        .map(|(chunk, delay_ms)| ((*chunk).to_string(), *delay_ms))
        .collect::<Vec<_>>();
    let server = thread::spawn(move || {
        let (mut stream, _) = listener.accept().expect("accept mock client");
        let mut request_buf = [0_u8; 2048];
        let _ = stream.read(&mut request_buf);
        let response_header =
            format!("HTTP/1.1 200 OK\r\nContent-Type: {content_type}\r\nConnection: close\r\n\r\n");
        stream
            .write_all(response_header.as_bytes())
            .expect("write streaming response headers");
        stream.flush().expect("flush streaming response headers");
        for (chunk, delay_ms) in chunks {
            if delay_ms > 0 {
                thread::sleep(Duration::from_millis(delay_ms));
            }
            stream
                .write_all(chunk.as_bytes())
                .expect("write streaming response chunk");
            stream.flush().expect("flush streaming response chunk");
        }
    });
    let response = reqwest::blocking::get(format!("http://{addr}")).expect("request mock upstream");
    (response, server)
}

#[test]
fn parse_usage_from_json_reads_cached_and_reasoning_details() {
    let payload = json!({
        "usage": {
            "input_tokens": 321,
            "input_tokens_details": { "cached_tokens": 280 },
            "output_tokens": 55,
            "total_tokens": 376,
            "output_tokens_details": { "reasoning_tokens": 21 }
        }
    });
    let usage = parse_usage_from_json(&payload);
    assert_eq!(usage.input_tokens, Some(321));
    assert_eq!(usage.cached_input_tokens, Some(280));
    assert_eq!(usage.output_tokens, Some(55));
    assert_eq!(usage.total_tokens, Some(376));
    assert_eq!(usage.reasoning_output_tokens, Some(21));
}

#[test]
fn parse_usage_from_json_reads_response_usage_compat_fields() {
    let payload = json!({
        "type": "response.completed",
        "response": {
            "usage": {
                "prompt_tokens": 100,
                "prompt_tokens_details": { "cached_tokens": 75 },
                "completion_tokens": 20,
                "total_tokens": 120,
                "completion_tokens_details": { "reasoning_tokens": 9 }
            }
        }
    });
    let usage = parse_usage_from_json(&payload);
    assert_eq!(usage.input_tokens, Some(100));
    assert_eq!(usage.cached_input_tokens, Some(75));
    assert_eq!(usage.output_tokens, Some(20));
    assert_eq!(usage.total_tokens, Some(120));
    assert_eq!(usage.reasoning_output_tokens, Some(9));
}

#[test]
fn parse_usage_from_json_merges_response_usage_over_top_level_usage() {
    let payload = json!({
        "usage": {
            "input_tokens": 11,
            "output_tokens": 7,
            "total_tokens": 18
        },
        "response": {
            "usage": {
                "prompt_tokens": 13,
                "prompt_tokens_details": { "cached_tokens": 5 },
                "completion_tokens": 9,
                "total_tokens": 22
            }
        }
    });
    let usage = parse_usage_from_json(&payload);
    assert_eq!(usage.input_tokens, Some(13));
    assert_eq!(usage.cached_input_tokens, Some(5));
    assert_eq!(usage.output_tokens, Some(9));
    assert_eq!(usage.total_tokens, Some(22));
    assert_eq!(usage.reasoning_output_tokens, None);
}

#[test]
fn parse_usage_from_sse_frame_reads_response_completed_usage() {
    let frame_lines = vec![
        "event: message\n".to_string(),
        r#"data: {"type":"response.completed","response":{"usage":{"input_tokens":88,"input_tokens_details":{"cached_tokens":61},"output_tokens":17,"total_tokens":105,"output_tokens_details":{"reasoning_tokens":6}}}}"#
            .to_string(),
        "\n".to_string(),
    ];
    let usage = parse_usage_from_sse_frame(&frame_lines).expect("extract usage from sse frame");
    assert_eq!(usage.input_tokens, Some(88));
    assert_eq!(usage.cached_input_tokens, Some(61));
    assert_eq!(usage.output_tokens, Some(17));
    assert_eq!(usage.total_tokens, Some(105));
    assert_eq!(usage.reasoning_output_tokens, Some(6));
}

#[test]
fn parse_usage_from_sse_frame_reads_top_level_and_response_usage() {
    let frame_lines = vec![
        "event: message\n".to_string(),
        r#"data: {"type":"response.completed","usage":{"input_tokens":22,"input_tokens_details":{"cached_tokens":10},"output_tokens":11,"total_tokens":33,"output_tokens_details":{"reasoning_tokens":3}},"response":{"usage":{"prompt_tokens":26,"prompt_tokens_details":{"cached_tokens":12},"completion_tokens":15,"total_tokens":41,"completion_tokens_details":{"reasoning_tokens":4}}}}"#
            .to_string(),
        "\n".to_string(),
    ];
    let usage = parse_usage_from_sse_frame(&frame_lines).expect("extract usage from sse frame");
    assert_eq!(usage.input_tokens, Some(26));
    assert_eq!(usage.cached_input_tokens, Some(12));
    assert_eq!(usage.output_tokens, Some(15));
    assert_eq!(usage.total_tokens, Some(41));
    assert_eq!(usage.reasoning_output_tokens, Some(4));
}

#[test]
fn parse_usage_from_sse_frame_caps_output_text() {
    let limit = super::output_text_limit_bytes();
    if limit == 0 || limit <= super::OUTPUT_TEXT_TRUNCATED_MARKER.len() {
        return;
    }

    let long = "a".repeat(limit.saturating_mul(3));
    let payload = json!({
        "choices": [
            {"delta": {"content": long}}
        ]
    });
    let frame_lines = vec![
        "event: message\n".to_string(),
        format!("data: {}", payload.to_string()),
        "\n".to_string(),
    ];
    let usage = parse_usage_from_sse_frame(&frame_lines).expect("extract usage from sse frame");
    let text = usage.output_text.unwrap_or_default();
    assert!(
        text.len() <= limit,
        "output_text exceeded limit: {} > {limit}",
        text.len()
    );
    assert!(text.ends_with(super::OUTPUT_TEXT_TRUNCATED_MARKER));
}

#[test]
fn inspect_sse_frame_recognizes_done_marker() {
    let frame_lines = vec![
        "event: message\n".to_string(),
        "data: [DONE]\n".to_string(),
        "\n".to_string(),
    ];
    let inspection = inspect_sse_frame(&frame_lines);
    assert!(inspection.terminal.is_some());
}

#[test]
fn anthropic_sse_reader_final_usage_contains_input_cache_and_output_tokens() {
    let (response, server) = open_streaming_mock_http_response(
        "text/event-stream",
        &[(
            "data: {\"type\":\"response.completed\",\"response\":{\"id\":\"resp_usage_1\",\"model\":\"gpt-5.3-codex\",\"usage\":{\"input_tokens\":31,\"input_tokens_details\":{\"cached_tokens\":7},\"output_tokens\":9,\"total_tokens\":40,\"output_tokens_details\":{\"reasoning_tokens\":2}},\"output\":[{\"type\":\"message\",\"content\":[{\"type\":\"output_text\",\"text\":\"ok\"}]}]}}\n\n\
             data: [DONE]\n\n",
            0,
        )],
    );
    let usage_collector = Arc::new(Mutex::new(super::UpstreamResponseUsage::default()));
    let mut reader = super::AnthropicSseReader::new(response, usage_collector);
    let mut out = String::new();
    reader
        .read_to_string(&mut out)
        .expect("read anthropic sse reader");
    server.join().expect("join streaming mock upstream");

    assert!(out.contains("\"type\":\"message_delta\""));
    assert!(out.contains("\"input_tokens\":31"));
    assert!(out.contains("\"cache_read_input_tokens\":7"));
    assert!(out.contains("\"output_tokens\":9"));
    assert!(out.contains("\"total_tokens\":40"));
    assert!(out.contains("\"reasoning_output_tokens\":2"));
}

#[test]
fn inspect_sse_frame_recognizes_response_failed_as_terminal_error() {
    let frame_lines = vec![
        "event: response.failed\n".to_string(),
        r#"data: {"type":"response.failed","error":{"message":"Internal server error"}}"#
            .to_string(),
        "\n".to_string(),
    ];
    let inspection = inspect_sse_frame(&frame_lines);
    let err = inspection
        .terminal
        .as_ref()
        .and_then(|t| match t {
            super::SseTerminal::Ok => None,
            super::SseTerminal::Err(msg) => Some(msg.as_str()),
        })
        .unwrap_or("");
    assert!(err.contains("Internal server error"));
}

#[test]
fn inspect_sse_frame_recognizes_response_done_as_terminal() {
    let frame_lines = vec![
        "event: response.done\n".to_string(),
        r#"data: {"type":"response.done","response":{"id":"resp_done_1"}}"#.to_string(),
        "\n".to_string(),
    ];
    let inspection = inspect_sse_frame(&frame_lines);
    assert!(inspection.terminal.is_some());
}

#[test]
fn inspect_sse_frame_recognizes_chat_completion_finish_reason_as_terminal() {
    let frame_lines = vec![
        "event: message\n".to_string(),
        r#"data: {"id":"chatcmpl_1","object":"chat.completion.chunk","model":"gpt-5.3-codex","choices":[{"index":0,"delta":{"content":"hi"},"finish_reason":"stop"}]}"#
            .to_string(),
        "\n".to_string(),
    ];
    let inspection = inspect_sse_frame(&frame_lines);
    assert!(inspection.terminal.is_some());
}

#[test]
fn inspect_sse_frame_recognizes_nested_response_error_message() {
    let frame_lines = vec![
        "event: response.failed\n".to_string(),
        r#"data: {"type":"response.failed","response":{"status":"failed","error":{"message":"Model not found","type":"invalid_request_error","code":"model_not_found"}}}"#
            .to_string(),
        "\n".to_string(),
    ];
    let inspection = inspect_sse_frame(&frame_lines);
    let err = inspection
        .terminal
        .as_ref()
        .and_then(|t| match t {
            super::SseTerminal::Ok => None,
            super::SseTerminal::Err(msg) => Some(msg.as_str()),
        })
        .unwrap_or("");
    assert!(err.contains("Model not found"), "unexpected err: {err}");
    assert!(err.contains("model_not_found"), "unexpected err: {err}");
}

#[test]
fn collect_non_stream_json_from_sse_bytes_extracts_response_completed() {
    let sse = concat!(
        "data: {\"type\":\"response.output_text.delta\",\"delta\":\"hello\"}\n\n",
        "data: {\"type\":\"response.completed\",\"response\":{\"id\":\"resp_1\",\"model\":\"gpt-5.3-codex\",\"output\":[{\"type\":\"message\",\"role\":\"assistant\",\"content\":[{\"type\":\"output_text\",\"text\":\"hello\"}]}],\"usage\":{\"input_tokens\":7,\"output_tokens\":3,\"total_tokens\":10}}}\n\n",
        "data: [DONE]\n\n"
    );
    let (body, usage) = collect_non_stream_json_from_sse_bytes(sse.as_bytes());
    let body = body.expect("synthesized response json");
    let value: serde_json::Value = serde_json::from_slice(&body).expect("parse synthesized body");
    assert_eq!(value["id"], "resp_1");
    assert_eq!(value["output"][0]["role"], "assistant");
    assert_eq!(usage.input_tokens, Some(7));
    assert_eq!(usage.output_tokens, Some(3));
    assert_eq!(usage.total_tokens, Some(10));
}

#[test]
fn collect_non_stream_json_from_sse_bytes_extracts_response_done() {
    let sse = concat!(
        "data: {\"type\":\"response.output_text.delta\",\"delta\":\"hello\"}\n\n",
        "data: {\"type\":\"response.done\",\"response\":{\"id\":\"resp_done_1\",\"model\":\"gpt-5.3-codex\",\"output\":[{\"type\":\"message\",\"role\":\"assistant\",\"content\":[{\"type\":\"output_text\",\"text\":\"hello\"}]}],\"usage\":{\"input_tokens\":7,\"output_tokens\":3,\"total_tokens\":10}}}\n\n",
        "data: [DONE]\n\n"
    );
    let (body, usage) = collect_non_stream_json_from_sse_bytes(sse.as_bytes());
    let body = body.expect("synthesized response json");
    let value: serde_json::Value = serde_json::from_slice(&body).expect("parse synthesized body");
    assert_eq!(value["id"], "resp_done_1");
    assert_eq!(value["output"][0]["role"], "assistant");
    assert_eq!(usage.input_tokens, Some(7));
    assert_eq!(usage.output_tokens, Some(3));
    assert_eq!(usage.total_tokens, Some(10));
}

#[test]
fn collect_non_stream_json_from_sse_bytes_synthesizes_chat_completion_chunks() {
    let sse = concat!(
        "data: {\"id\":\"chatcmpl_1\",\"object\":\"chat.completion.chunk\",\"created\":1,\"model\":\"gpt-5.3-codex\",\"choices\":[{\"index\":0,\"delta\":{\"role\":\"assistant\",\"content\":\"hel\"},\"finish_reason\":null}]}\n\n",
        "data: {\"id\":\"chatcmpl_1\",\"object\":\"chat.completion.chunk\",\"created\":1,\"model\":\"gpt-5.3-codex\",\"usage\":{\"prompt_tokens\":7,\"completion_tokens\":3,\"total_tokens\":10},\"choices\":[{\"index\":0,\"delta\":{\"content\":\"lo\"},\"finish_reason\":\"stop\"}]}\n\n"
    );
    let (body, usage) = collect_non_stream_json_from_sse_bytes(sse.as_bytes());
    let body = body.expect("synthesized chat completion json");
    let value: serde_json::Value = serde_json::from_slice(&body).expect("parse synthesized body");
    assert_eq!(value["id"], "chatcmpl_1");
    assert_eq!(value["object"], "chat.completion");
    assert_eq!(value["choices"][0]["message"]["role"], "assistant");
    assert_eq!(value["choices"][0]["message"]["content"], "hello");
    assert_eq!(value["choices"][0]["finish_reason"], "stop");
    assert_eq!(usage.input_tokens, Some(7));
    assert_eq!(usage.output_tokens, Some(3));
    assert_eq!(usage.total_tokens, Some(10));
}

#[test]
fn extract_openai_completed_output_text_reads_completed_output_message_text() {
    let payload = json!({
        "type": "response.completed",
        "response": {
            "output": [{
                "type": "message",
                "content": [{
                    "type": "output_text",
                    "text": "hello from completed"
                }]
            }]
        }
    });
    let text = extract_openai_completed_output_text(&payload).unwrap_or_default();
    assert_eq!(text, "hello from completed");
}

#[test]
fn apply_openai_stream_meta_defaults_fills_missing_chunk_meta() {
    let mut mapped = json!({
        "id": "",
        "object": "chat.completion.chunk",
        "created": 0,
        "model": "",
        "choices": [{
            "index": 0,
            "delta": {"content": "hello"},
            "finish_reason": null
        }]
    });
    let meta = OpenAIStreamMeta {
        response_id: Some("resp_meta_1".to_string()),
        model: Some("gpt-5.3-codex".to_string()),
        created: Some(1700000123),
    };
    apply_openai_stream_meta_defaults(&mut mapped, &meta);
    assert_eq!(mapped["id"], "resp_meta_1");
    assert_eq!(mapped["model"], "gpt-5.3-codex");
    assert_eq!(mapped["created"], 1700000123);
}

#[test]
fn collect_non_stream_json_from_sse_bytes_backfills_response_output_from_deltas() {
    let sse = concat!(
        "data: {\"type\":\"response.created\",\"response\":{\"id\":\"resp_delta_1\",\"created\":2,\"model\":\"gpt-5.3-codex\"}}\n\n",
        "data: {\"type\":\"response.output_text.delta\",\"response_id\":\"resp_delta_1\",\"delta\":\"hello \"}\n\n",
        "data: {\"type\":\"response.output_text.delta\",\"response_id\":\"resp_delta_1\",\"delta\":\"world\"}\n\n",
        "data: {\"type\":\"response.completed\",\"response\":{\"id\":\"resp_delta_1\",\"created\":2,\"model\":\"gpt-5.3-codex\",\"usage\":{\"input_tokens\":9,\"output_tokens\":2,\"total_tokens\":11}}}\n\n",
        "data: [DONE]\n\n"
    );
    let (body, usage) = collect_non_stream_json_from_sse_bytes(sse.as_bytes());
    let body = body.expect("synthesized response json");
    let value: serde_json::Value = serde_json::from_slice(&body).expect("parse synthesized body");
    assert_eq!(value["id"], "resp_delta_1");
    assert_eq!(value["object"], "response");
    assert_eq!(
        value["output"][0]["content"][0]["text"],
        serde_json::Value::String("hello world".to_string())
    );
    assert_eq!(
        value["output_text"],
        serde_json::Value::String("hello world".to_string())
    );
    assert_eq!(usage.input_tokens, Some(9));
    assert_eq!(usage.output_tokens, Some(2));
    assert_eq!(usage.total_tokens, Some(11));
}

#[test]
fn collect_non_stream_json_from_sse_bytes_backfills_reasoning_output_items() {
    let sse = concat!(
        "data: {\"type\":\"response.output_item.done\",\"response_id\":\"resp_reason_1\",\"output_index\":0,\"item\":{\"type\":\"reasoning\",\"id\":\"rs_1\",\"summary\":[{\"type\":\"summary_text\",\"text\":\"先读配置\"}],\"encrypted_content\":\"sig_reason_1\"}}\n\n",
        "data: {\"type\":\"response.completed\",\"response\":{\"id\":\"resp_reason_1\",\"created\":5,\"model\":\"gpt-5.3-codex\",\"usage\":{\"input_tokens\":4,\"output_tokens\":2,\"total_tokens\":6}}}\n\n",
        "data: [DONE]\n\n"
    );
    let (body, usage) = collect_non_stream_json_from_sse_bytes(sse.as_bytes());
    let body = body.expect("synthesized response json");
    let value: serde_json::Value = serde_json::from_slice(&body).expect("parse synthesized body");
    assert_eq!(value["id"], "resp_reason_1");
    assert_eq!(value["output"][0]["type"], "reasoning");
    assert_eq!(value["output"][0]["summary"][0]["text"], "先读配置");
    assert_eq!(value["output"][0]["encrypted_content"], "sig_reason_1");
    assert!(value.get("output_text").is_none());
    assert_eq!(usage.input_tokens, Some(4));
    assert_eq!(usage.output_tokens, Some(2));
    assert_eq!(usage.total_tokens, Some(6));
}

#[test]
fn collect_non_stream_json_from_sse_bytes_backfills_function_call_output_items() {
    let sse = concat!(
        "data: {\"type\":\"response.output_item.added\",\"response_id\":\"resp_tool_agg_1\",\"output_index\":0,\"item\":{\"type\":\"function_call\",\"call_id\":\"call_read_1\",\"name\":\"read_file\"}}\n\n",
        "data: {\"type\":\"response.function_call_arguments.delta\",\"response_id\":\"resp_tool_agg_1\",\"output_index\":0,\"delta\":\"{\\\"path\\\":\\\"REA\"}\n\n",
        "data: {\"type\":\"response.function_call_arguments.delta\",\"response_id\":\"resp_tool_agg_1\",\"output_index\":0,\"delta\":\"DME.md\\\"}\"}\n\n",
        "data: {\"type\":\"response.completed\",\"response\":{\"id\":\"resp_tool_agg_1\",\"created\":6,\"model\":\"gpt-5.3-codex\",\"usage\":{\"input_tokens\":6,\"output_tokens\":1,\"total_tokens\":7}}}\n\n",
        "data: [DONE]\n\n"
    );
    let (body, usage) = collect_non_stream_json_from_sse_bytes(sse.as_bytes());
    let body = body.expect("synthesized response json");
    let value: serde_json::Value = serde_json::from_slice(&body).expect("parse synthesized body");
    assert_eq!(value["id"], "resp_tool_agg_1");
    assert_eq!(value["output"][0]["type"], "function_call");
    assert_eq!(value["output"][0]["call_id"], "call_read_1");
    assert_eq!(value["output"][0]["name"], "read_file");
    assert_eq!(value["output"][0]["arguments"], "{\"path\":\"README.md\"}");
    assert!(value.get("output_text").is_none());
    assert_eq!(usage.input_tokens, Some(6));
    assert_eq!(usage.output_tokens, Some(1));
    assert_eq!(usage.total_tokens, Some(7));
}

#[test]
fn parse_sse_frame_json_infers_type_from_event_name() {
    let frame_lines = vec![
        "event: response.output_text.delta\n".to_string(),
        r#"data: {"response_id":"resp_evt_1","delta":"hello"}"#.to_string(),
        "\n".to_string(),
    ];
    let value = parse_sse_frame_json(&frame_lines).expect("parse sse frame");
    assert_eq!(value["type"], "response.output_text.delta");
    assert_eq!(value["delta"], "hello");
}

#[test]
fn collect_non_stream_json_from_sse_bytes_supports_event_only_type_frames() {
    let sse = concat!(
        "event: response.output_text.delta\n",
        "data: {\"response_id\":\"resp_evt_1\",\"delta\":\"hello \"}\n\n",
        "event: response.output_text.delta\n",
        "data: {\"response_id\":\"resp_evt_1\",\"delta\":\"world\"}\n\n",
        "event: response.completed\n",
        "data: {\"response\":{\"id\":\"resp_evt_1\",\"created\":3,\"model\":\"gpt-5.3-codex\",\"usage\":{\"input_tokens\":3,\"output_tokens\":2,\"total_tokens\":5}}}\n\n",
        "data: [DONE]\n\n"
    );
    let (body, usage) = collect_non_stream_json_from_sse_bytes(sse.as_bytes());
    let body = body.expect("synthesized response json");
    let value: serde_json::Value = serde_json::from_slice(&body).expect("parse synthesized body");
    assert_eq!(value["id"], "resp_evt_1");
    assert_eq!(
        value["output_text"],
        serde_json::Value::String("hello world".to_string())
    );
    assert_eq!(usage.input_tokens, Some(3));
    assert_eq!(usage.output_tokens, Some(2));
    assert_eq!(usage.total_tokens, Some(5));
}

#[test]
fn parse_sse_frame_json_supports_json_lines_without_data_prefix() {
    let frame_lines = vec![
        r#"{"type":"response.output_text.delta","response_id":"resp_jsonl_1","delta":"hi"}"#
            .to_string(),
        "\n".to_string(),
    ];
    let value = parse_sse_frame_json(&frame_lines).expect("parse jsonl frame");
    assert_eq!(value["type"], "response.output_text.delta");
    assert_eq!(value["delta"], "hi");
}

#[test]
fn synthesize_chat_completion_sse_from_json_emits_done_stream() {
    let payload = json!({
        "id": "chatcmpl_test_1",
        "object": "chat.completion",
        "created": 1772519000,
        "model": "gpt-5.3-codex",
        "choices": [{
            "index": 0,
            "message": {
                "role": "assistant",
                "content": "OK"
            },
            "finish_reason": "stop"
        }],
        "usage": {
            "prompt_tokens": 7,
            "completion_tokens": 1,
            "total_tokens": 8
        }
    });
    let sse = synthesize_chat_completion_sse_from_json(&payload);
    let sse_text = String::from_utf8_lossy(&sse);
    assert!(sse_text.contains("chat.completion.chunk"));
    assert!(sse_text.contains("data: [DONE]"));

    let (json_body, usage) = collect_non_stream_json_from_sse_bytes(&sse);
    let json_body = json_body.expect("synthesized chat json");
    let value: serde_json::Value = serde_json::from_slice(&json_body).expect("parse chat json");
    assert_eq!(value["object"], "chat.completion");
    assert_eq!(value["choices"][0]["message"]["content"], "OK");
    assert_eq!(usage.output_tokens, Some(1));
}

#[test]
fn synthesize_completions_sse_from_json_emits_done_stream() {
    let payload = json!({
        "id": "cmpl_test_1",
        "object": "text_completion",
        "created": 1772519001,
        "model": "gpt-5.3-codex",
        "choices": [{
            "index": 0,
            "text": "Hello",
            "finish_reason": "stop"
        }],
        "usage": {
            "prompt_tokens": 6,
            "completion_tokens": 1,
            "total_tokens": 7
        }
    });
    let sse = synthesize_completions_sse_from_json(&payload);
    let sse_text = String::from_utf8_lossy(&sse);
    assert!(sse_text.contains("text_completion"));
    assert!(sse_text.contains("\"text\":\"Hello\""));
    assert!(sse_text.contains("\"finish_reason\":\"stop\""));
    assert!(sse_text.contains("data: [DONE]"));
}

#[test]
fn live_chat_stream_skips_done_and_message_item_text_events() {
    let output_text_done = json!({
        "type": "response.output_text.done",
        "text": "full text"
    });
    assert!(should_skip_chat_live_text_event(
        "response.output_text.done",
        &output_text_done
    ));

    let message_item_done = json!({
        "type": "response.output_item.done",
        "item": {
            "type": "message",
            "content": [{"type":"output_text","text":"full text"}]
        }
    });
    assert!(should_skip_chat_live_text_event(
        "response.output_item.done",
        &message_item_done
    ));

    let function_item_done = json!({
        "type": "response.output_item.done",
        "item": {
            "type": "function_call",
            "name": "tool",
            "arguments": "{}"
        }
    });
    assert!(!should_skip_chat_live_text_event(
        "response.output_item.done",
        &function_item_done
    ));
}

#[test]
fn live_completion_stream_skips_done_and_message_item_text_events() {
    let output_text_done = json!({
        "type": "response.output_text.done",
        "text": "full text"
    });
    assert!(should_skip_completion_live_text_event(
        "response.output_text.done",
        &output_text_done
    ));

    let message_item_added = json!({
        "type": "response.output_item.added",
        "item": {
            "type": "message",
            "content": [{"type":"output_text","text":"full text"}]
        }
    });
    assert!(should_skip_completion_live_text_event(
        "response.output_item.added",
        &message_item_added
    ));

    let function_item_added = json!({
        "type": "response.output_item.added",
        "item": {
            "type": "function_call",
            "name": "tool",
            "arguments": "{}"
        }
    });
    assert!(!should_skip_completion_live_text_event(
        "response.output_item.added",
        &function_item_added
    ));
}

#[test]
fn normalize_chat_chunk_delta_role_keeps_first_and_removes_later() {
    let mut role_emitted = false;
    let mut first = json!({
        "object":"chat.completion.chunk",
        "choices":[{"index":0,"delta":{"role":"assistant","content":"你"}}]
    });
    normalize_chat_chunk_delta_role(&mut first, &mut role_emitted);
    assert_eq!(first["choices"][0]["delta"]["role"], "assistant");
    assert!(role_emitted);

    let mut second = json!({
        "object":"chat.completion.chunk",
        "choices":[{"index":0,"delta":{"role":"assistant","content":"好"}}]
    });
    normalize_chat_chunk_delta_role(&mut second, &mut role_emitted);
    assert!(second["choices"][0]["delta"].get("role").is_none());
    assert_eq!(second["choices"][0]["delta"]["content"], "好");
}

#[test]
fn openai_chat_sse_reader_requires_terminal_event_before_success() {
    let upstream = open_mock_http_response(
        "text/event-stream",
        concat!(
            "data: {\"type\":\"response.created\",\"response\":{\"id\":\"resp_chat_incomplete_1\",\"created\":1,\"model\":\"gpt-5.3-codex\"}}\n\n",
            "data: {\"type\":\"response.output_text.delta\",\"response_id\":\"resp_chat_incomplete_1\",\"delta\":\"hel\"}\n\n",
            "data: {\"type\":\"response.output_text.delta\",\"response_id\":\"resp_chat_incomplete_1\",\"delta\":\"lo\"}\n\n"
        ),
    );
    let usage_collector = Arc::new(Mutex::new(PassthroughSseCollector::default()));
    let mut reader =
        OpenAIChatCompletionsSseReader::new(upstream, Arc::clone(&usage_collector), None);
    let mut mapped = String::new();
    reader
        .read_to_string(&mut mapped)
        .expect("read mapped chat sse");
    let collector = usage_collector
        .lock()
        .expect("lock usage collector")
        .clone();
    assert!(mapped.contains("chat.completion.chunk"));
    assert!(!mapped.contains("data: [DONE]"));
    assert!(!collector.saw_terminal);
    assert_eq!(
        collector.terminal_error.as_deref(),
        Some("上游流中途中断（未正常结束）")
    );
}

#[test]
fn openai_completions_sse_reader_requires_terminal_event_before_success() {
    let upstream = open_mock_http_response(
        "text/event-stream",
        concat!(
            "data: {\"type\":\"response.created\",\"response\":{\"id\":\"resp_completion_incomplete_1\",\"created\":1,\"model\":\"gpt-5.3-codex\"}}\n\n",
            "data: {\"type\":\"response.output_text.delta\",\"response_id\":\"resp_completion_incomplete_1\",\"delta\":\"Hello\"}\n\n"
        ),
    );
    let usage_collector = Arc::new(Mutex::new(PassthroughSseCollector::default()));
    let mut reader = OpenAICompletionsSseReader::new(upstream, Arc::clone(&usage_collector));
    let mut mapped = String::new();
    reader
        .read_to_string(&mut mapped)
        .expect("read mapped completions sse");
    let collector = usage_collector
        .lock()
        .expect("lock usage collector")
        .clone();
    assert!(mapped.contains("\"object\":\"text_completion\""));
    assert!(!mapped.contains("data: [DONE]"));
    assert!(!collector.saw_terminal);
    assert_eq!(
        collector.terminal_error.as_deref(),
        Some("上游流中途中断（未正常结束）")
    );
}

#[test]
fn passthrough_sse_reader_emits_keepalive_for_responses_stream() {
    let _guard = test_env_guard();
    let _keepalive_guard = EnvGuard::set("CODEXMANAGER_SSE_KEEPALIVE_INTERVAL_MS", "15");
    super::reload_from_env();

    let (upstream, server) = open_streaming_mock_http_response(
        "text/event-stream",
        &[
            (
                "data: {\"type\":\"response.created\",\"response\":{\"id\":\"resp_keepalive_1\"}}\n\n",
                50,
            ),
            ("data: [DONE]\n\n", 0),
        ],
    );
    let usage_collector = Arc::new(Mutex::new(PassthroughSseCollector::default()));
    let mut reader = PassthroughSseUsageReader::new(
        upstream,
        Arc::clone(&usage_collector),
        SseKeepAliveFrame::OpenAIResponses,
    );
    let mut mapped = String::new();
    reader
        .read_to_string(&mut mapped)
        .expect("read passthrough sse");
    server.join().expect("join streaming mock upstream");
    super::reload_from_env();

    assert!(mapped.contains("\"type\":\"codexmanager.keepalive\""));
    assert!(mapped.contains("\"type\":\"response.created\""));
    assert!(mapped.contains("data: [DONE]"));
}

#[test]
fn passthrough_sse_reader_captures_raw_html_error_body() {
    let (upstream, server) = open_streaming_mock_http_response(
        "text/html",
        &[(
            "<html><title>Just a moment...</title><body>cf</body></html>",
            0,
        )],
    );
    let usage_collector = Arc::new(Mutex::new(PassthroughSseCollector::default()));
    let mut reader = PassthroughSseUsageReader::new(
        upstream,
        Arc::clone(&usage_collector),
        SseKeepAliveFrame::OpenAIResponses,
    );
    let mut mapped = String::new();
    reader
        .read_to_string(&mut mapped)
        .expect("read passthrough html body");
    server.join().expect("join html mock upstream");

    let collector = usage_collector
        .lock()
        .expect("lock usage collector")
        .clone();
    assert!(mapped.contains("Just a moment"));
    assert_eq!(
        collector.upstream_error_hint.as_deref(),
        Some("Cloudflare 安全验证页（title=Just a moment...）")
    );
    assert_eq!(
        collector.terminal_error.as_deref(),
        Some("上游流中途中断（未正常结束）")
    );
}

#[test]
fn openai_chat_sse_reader_emits_keepalive_chunk_during_idle_gap() {
    let _guard = test_env_guard();
    let _keepalive_guard = EnvGuard::set("CODEXMANAGER_SSE_KEEPALIVE_INTERVAL_MS", "15");
    super::reload_from_env();

    let (upstream, server) = open_streaming_mock_http_response(
        "text/event-stream",
        &[
            (
                "data: {\"type\":\"response.completed\",\"response\":{\"id\":\"resp_chat_keepalive_1\",\"created\":1,\"model\":\"gpt-5.3-codex\",\"output\":[{\"type\":\"message\",\"role\":\"assistant\",\"content\":[{\"type\":\"output_text\",\"text\":\"hello\"}]}]}}\n\n",
                50,
            ),
            ("data: [DONE]\n\n", 0),
        ],
    );
    let usage_collector = Arc::new(Mutex::new(PassthroughSseCollector::default()));
    let mut reader =
        OpenAIChatCompletionsSseReader::new(upstream, Arc::clone(&usage_collector), None);
    let mut mapped = String::new();
    reader
        .read_to_string(&mut mapped)
        .expect("read chat completions sse");
    server.join().expect("join streaming mock upstream");
    super::reload_from_env();

    assert!(mapped.contains("\"id\":\"cm_keepalive\""));
    assert!(mapped.contains("\"object\":\"chat.completion.chunk\""));
    assert!(mapped.contains("data: [DONE]"));
}
