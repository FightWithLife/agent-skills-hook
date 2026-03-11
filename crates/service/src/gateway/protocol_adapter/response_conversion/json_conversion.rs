use serde_json::{json, Map, Value};

use super::tool_mapping::restore_openai_tool_name;
use super::ToolNameRestoreMap;

fn map_openai_error_to_anthropic(value: &Value) -> Option<Value> {
    let error = value.get("error")?.as_object()?;
    let message = error
        .get("message")
        .and_then(Value::as_str)
        .unwrap_or("upstream request failed")
        .to_string();
    let error_type = error
        .get("type")
        .and_then(Value::as_str)
        .unwrap_or("api_error");

    let mapped_error_type = match error_type {
        "authentication_error" => "authentication_error",
        "permission_error" => "permission_error",
        "rate_limit_error" => "rate_limit_error",
        "invalid_request_error" | "not_found_error" => "invalid_request_error",
        _ => "api_error",
    };

    Some(json!({
        "type": "error",
        "error": {
            "type": mapped_error_type,
            "message": message,
        }
    }))
}

pub(super) fn convert_openai_json_to_anthropic(
    body: &[u8],
    tool_name_restore_map: Option<&ToolNameRestoreMap>,
) -> Result<(Vec<u8>, &'static str), String> {
    let value: Value =
        serde_json::from_slice(body).map_err(|_| "invalid upstream json response".to_string())?;
    if let Some(error_payload) = map_openai_error_to_anthropic(&value) {
        return serde_json::to_vec(&error_payload)
            .map(|bytes| (bytes, "application/json"))
            .map_err(|err| format!("serialize claude error response failed: {err}"));
    }

    let payload = if value.get("choices").is_some() {
        build_anthropic_message_from_chat_completions(&value, tool_name_restore_map)?
    } else {
        build_anthropic_message_from_responses(&value, tool_name_restore_map)?
    };

    serde_json::to_vec(&payload)
        .map(|bytes| (bytes, "application/json"))
        .map_err(|err| format!("serialize claude response failed: {err}"))
}

fn build_anthropic_message_from_chat_completions(
    value: &Value,
    tool_name_restore_map: Option<&ToolNameRestoreMap>,
) -> Result<Value, String> {
    let model = value
        .get("model")
        .and_then(Value::as_str)
        .unwrap_or("unknown");
    let id = value
        .get("id")
        .and_then(Value::as_str)
        .unwrap_or("msg_codexmanager");

    let choice = value
        .get("choices")
        .and_then(Value::as_array)
        .and_then(|choices| choices.first())
        .ok_or_else(|| "missing upstream choice".to_string())?;

    let message = choice
        .get("message")
        .and_then(Value::as_object)
        .ok_or_else(|| "missing upstream message object".to_string())?;
    let content_text = extract_openai_text_content(message.get("content").unwrap_or(&Value::Null))?;
    let tool_calls = message
        .get("tool_calls")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let stop_reason = if !tool_calls.is_empty() {
        "tool_use".to_string()
    } else {
        map_finish_reason(
            choice
                .get("finish_reason")
                .and_then(Value::as_str)
                .unwrap_or("stop"),
        )
        .to_string()
    };

    let mut content_blocks = Vec::new();
    if !content_text.is_empty() {
        content_blocks.push(json!({
            "type": "text",
            "text": content_text,
        }));
    }
    for (index, tool_call) in tool_calls.iter().enumerate() {
        let tool_use_id = tool_call
            .get("id")
            .and_then(Value::as_str)
            .map(|v| v.to_string())
            .unwrap_or_else(|| format!("toolu_{index}"));
        let function_name = tool_call
            .get("function")
            .and_then(|item| item.get("name"))
            .and_then(Value::as_str)
            .ok_or_else(|| "missing tool call function name".to_string())?;
        let function_name = restore_openai_tool_name(function_name, tool_name_restore_map);
        let arguments_raw = tool_call
            .get("function")
            .and_then(|item| item.get("arguments"))
            .and_then(Value::as_str)
            .unwrap_or("{}");
        let input = parse_tool_arguments_as_object(arguments_raw);
        content_blocks.push(json!({
            "type": "tool_use",
            "id": tool_use_id,
            "name": function_name,
            "input": input,
        }));
    }
    if content_blocks.is_empty() {
        content_blocks.push(json!({
            "type": "text",
            "text": "",
        }));
    }

    let usage = build_anthropic_usage(value.get("usage").and_then(Value::as_object));

    Ok(json!({
        "id": id,
        "type": "message",
        "role": "assistant",
        "model": model,
        "content": content_blocks,
        "stop_reason": stop_reason,
        "stop_sequence": Value::Null,
        "usage": usage,
    }))
}

fn build_anthropic_message_from_responses(
    value: &Value,
    tool_name_restore_map: Option<&ToolNameRestoreMap>,
) -> Result<Value, String> {
    let model = value
        .get("model")
        .and_then(Value::as_str)
        .unwrap_or("unknown");
    let id = value
        .get("id")
        .and_then(Value::as_str)
        .unwrap_or("msg_codexmanager");

    let mut content_blocks = Vec::new();
    let mut has_tool_use = false;
    let mut saw_message_text = false;

    if let Some(output_items) = value.get("output").and_then(Value::as_array) {
        for output_item in output_items {
            let Some(item_obj) = output_item.as_object() else {
                continue;
            };
            let item_type = item_obj
                .get("type")
                .and_then(Value::as_str)
                .unwrap_or_default();
            match item_type {
                "message" => {
                    let content = item_obj.get("content").and_then(Value::as_array);
                    if let Some(content) = content {
                        for block in content {
                            let Some(block_obj) = block.as_object() else {
                                continue;
                            };
                            let block_type = block_obj
                                .get("type")
                                .and_then(Value::as_str)
                                .unwrap_or_default();
                            if block_type == "output_text" || block_type == "text" {
                                if let Some(text) = block_obj.get("text").and_then(Value::as_str) {
                                    if push_anthropic_text_block(&mut content_blocks, text) {
                                        saw_message_text = true;
                                    }
                                }
                            }
                        }
                    }
                }
                "function_call" => {
                    let tool_use_id = item_obj
                        .get("call_id")
                        .or_else(|| item_obj.get("id"))
                        .and_then(Value::as_str)
                        .map(str::to_string)
                        .unwrap_or_else(|| format!("toolu_{}", content_blocks.len()));
                    let Some(function_name) = item_obj
                        .get("name")
                        .and_then(Value::as_str)
                        .map(str::trim)
                        .filter(|name| !name.is_empty())
                    else {
                        continue;
                    };
                    let function_name =
                        restore_openai_tool_name(function_name, tool_name_restore_map);
                    let input = extract_function_call_input_object(item_obj);
                    content_blocks.push(json!({
                        "type": "tool_use",
                        "id": tool_use_id,
                        "name": function_name,
                        "input": input,
                    }));
                    has_tool_use = true;
                }
                "custom_tool_call" => {
                    let tool_use_id = item_obj
                        .get("call_id")
                        .or_else(|| item_obj.get("id"))
                        .and_then(Value::as_str)
                        .map(str::to_string)
                        .unwrap_or_else(|| format!("toolu_{}", content_blocks.len()));
                    let Some(function_name) = item_obj
                        .get("name")
                        .and_then(Value::as_str)
                        .map(str::trim)
                        .filter(|name| !name.is_empty())
                    else {
                        continue;
                    };
                    let function_name =
                        restore_openai_tool_name(function_name, tool_name_restore_map);
                    let input = extract_function_call_input_object(item_obj);
                    content_blocks.push(json!({
                        "type": "tool_use",
                        "id": tool_use_id,
                        "name": function_name,
                        "input": input,
                    }));
                    has_tool_use = true;
                }
                "function_call_output" | "custom_tool_call_output" => {
                    if let Some(text) = extract_response_item_output_text(item_obj) {
                        if push_anthropic_text_block(&mut content_blocks, text.as_str()) {
                            saw_message_text = true;
                        }
                    }
                }
                "reasoning" => {
                    if let Some(block) = map_responses_reasoning_item_to_anthropic(item_obj) {
                        content_blocks.push(block);
                    }
                }
                _ => {
                    if let Some(summary) = summarize_special_response_item_text(item_obj) {
                        if push_anthropic_text_block(&mut content_blocks, summary.as_str()) {
                            saw_message_text = true;
                        }
                    }
                }
            }
        }
    }

    if !saw_message_text {
        if let Some(output_text) = value.get("output_text").and_then(Value::as_str) {
            push_anthropic_text_block(&mut content_blocks, output_text);
        }
    }

    if content_blocks.is_empty() {
        content_blocks.push(json!({
            "type": "text",
            "text": "",
        }));
    }

    let usage = build_anthropic_usage(value.get("usage").and_then(Value::as_object));

    let stop_reason = if has_tool_use {
        "tool_use".to_string()
    } else {
        "end_turn".to_string()
    };

    Ok(json!({
        "id": id,
        "type": "message",
        "role": "assistant",
        "model": model,
        "content": content_blocks,
        "stop_reason": stop_reason,
        "stop_sequence": Value::Null,
        "usage": usage,
    }))
}

fn build_anthropic_usage(usage: Option<&Map<String, Value>>) -> Value {
    let mut out = Map::new();
    out.insert(
        "input_tokens".to_string(),
        Value::from(extract_usage_i64(usage, &["input_tokens", "prompt_tokens"]).unwrap_or(0)),
    );
    out.insert(
        "output_tokens".to_string(),
        Value::from(extract_usage_i64(usage, &["output_tokens", "completion_tokens"]).unwrap_or(0)),
    );

    if let Some(cache_creation_input_tokens) = extract_usage_i64(
        usage,
        &["cache_creation_input_tokens", "input_tokens_details.cache_creation_tokens"],
    ) {
        out.insert(
            "cache_creation_input_tokens".to_string(),
            Value::from(cache_creation_input_tokens),
        );
    }
    if let Some(cache_read_input_tokens) = extract_usage_i64(
        usage,
        &[
            "cache_read_input_tokens",
            "input_tokens_details.cached_tokens",
            "prompt_tokens_details.cached_tokens",
        ],
    ) {
        out.insert(
            "cache_read_input_tokens".to_string(),
            Value::from(cache_read_input_tokens),
        );
    }

    Value::Object(out)
}

fn extract_usage_i64(usage: Option<&Map<String, Value>>, paths: &[&str]) -> Option<i64> {
    let usage = usage?;
    for path in paths {
        let mut cursor = None;
        for (index, segment) in path.split('.').enumerate() {
            cursor = if index == 0 {
                usage.get(segment)
            } else {
                cursor.and_then(Value::as_object).and_then(|map| map.get(segment))
            };
        }
        if let Some(value) = cursor.and_then(Value::as_i64) {
            return Some(value);
        }
    }
    None
}

fn push_anthropic_text_block(content_blocks: &mut Vec<Value>, text: &str) -> bool {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return false;
    }

    if content_blocks
        .last()
        .and_then(Value::as_object)
        .is_some_and(|last| {
            last.get("type").and_then(Value::as_str) == Some("text")
                && last.get("text").and_then(Value::as_str) == Some(trimmed)
        })
    {
        return false;
    }

    content_blocks.push(json!({
        "type": "text",
        "text": trimmed,
    }));
    true
}

pub(super) fn summarize_special_response_item_text(
    item_obj: &serde_json::Map<String, Value>,
) -> Option<String> {
    let item_type = item_obj
        .get("type")
        .and_then(Value::as_str)
        .unwrap_or_default();

    match item_type {
        "web_search_call" => summarize_web_search_call(item_obj),
        "image_generation_call" => summarize_image_generation_call(item_obj),
        "local_shell_call" => summarize_local_shell_call(item_obj),
        _ => None,
    }
}

fn extract_response_item_output_text(item_obj: &serde_json::Map<String, Value>) -> Option<String> {
    fn collect_output(value: &Value, out: &mut Vec<String>) {
        match value {
            Value::String(text) => {
                let trimmed = text.trim();
                if !trimmed.is_empty() {
                    out.push(trimmed.to_string());
                }
            }
            Value::Array(items) => {
                for item in items {
                    collect_output(item, out);
                }
            }
            Value::Object(map) => {
                if let Some(text) = map.get("text").and_then(Value::as_str) {
                    let trimmed = text.trim();
                    if !trimmed.is_empty() {
                        out.push(trimmed.to_string());
                    }
                }
                if let Some(output) = map.get("output") {
                    collect_output(output, out);
                }
                if let Some(content) = map.get("content") {
                    collect_output(content, out);
                }
            }
            _ => {}
        }
    }

    let mut parts = Vec::new();
    if let Some(output) = item_obj.get("output") {
        collect_output(output, &mut parts);
    }
    if parts.is_empty() {
        None
    } else {
        Some(parts.join("\n"))
    }
}

fn summarize_web_search_call(item_obj: &serde_json::Map<String, Value>) -> Option<String> {
    let status = item_obj
        .get("status")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("unknown");
    let action = item_obj.get("action").and_then(Value::as_object);
    let summary = match action
        .and_then(|action| action.get("type"))
        .and_then(Value::as_str)
        .unwrap_or_default()
    {
        "search" => {
            let query = action
                .and_then(|action| action.get("query"))
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty());
            let queries = action
                .and_then(|action| action.get("queries"))
                .and_then(Value::as_array)
                .map(|items| {
                    items
                        .iter()
                        .filter_map(Value::as_str)
                        .map(str::trim)
                        .filter(|value| !value.is_empty())
                        .collect::<Vec<_>>()
                })
                .filter(|items| !items.is_empty());
            if let Some(query) = query {
                format!("[web_search_call] status={status} query={query}")
            } else if let Some(queries) = queries {
                format!(
                    "[web_search_call] status={status} queries={}",
                    queries.join(" | ")
                )
            } else {
                format!("[web_search_call] status={status}")
            }
        }
        "open_page" => {
            let url = action
                .and_then(|action| action.get("url"))
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty());
            url.map_or_else(
                || format!("[web_search_call] status={status} action=open_page"),
                |url| format!("[web_search_call] status={status} open_page={url}"),
            )
        }
        "find_in_page" => {
            let url = action
                .and_then(|action| action.get("url"))
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .unwrap_or("-");
            let pattern = action
                .and_then(|action| action.get("pattern"))
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .unwrap_or("-");
            format!("[web_search_call] status={status} find_in_page url={url} pattern={pattern}")
        }
        _ => format!("[web_search_call] status={status}"),
    };
    Some(summary)
}

fn summarize_image_generation_call(item_obj: &serde_json::Map<String, Value>) -> Option<String> {
    let status = item_obj
        .get("status")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("unknown");
    let revised_prompt = item_obj
        .get("revised_prompt")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let result_hint = item_obj
        .get("result")
        .and_then(Value::as_str)
        .map(str::len)
        .filter(|len| *len > 0);
    let mut parts = vec![format!("[image_generation_call] status={status}")];
    if let Some(prompt) = revised_prompt {
        parts.push(format!("prompt={prompt}"));
    }
    if let Some(len) = result_hint {
        parts.push(format!("result_bytes={len}"));
    }
    Some(parts.join(" "))
}

fn summarize_local_shell_call(item_obj: &serde_json::Map<String, Value>) -> Option<String> {
    let status = item_obj
        .get("status")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("unknown");
    let action = item_obj.get("action").and_then(Value::as_object);
    let command = action
        .and_then(|action| action.get("command"))
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .collect::<Vec<_>>()
        })
        .filter(|items| !items.is_empty());
    let working_directory = action
        .and_then(|action| action.get("working_directory"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty());

    let mut parts = vec![format!("[local_shell_call] status={status}")];
    if let Some(command) = command {
        parts.push(format!("command={}", command.join(" ")));
    }
    if let Some(working_directory) = working_directory {
        parts.push(format!("cwd={working_directory}"));
    }
    Some(parts.join(" "))
}

fn map_responses_reasoning_item_to_anthropic(
    item_obj: &serde_json::Map<String, Value>,
) -> Option<Value> {
    let thinking = extract_responses_reasoning_text(item_obj);
    let signature = item_obj
        .get("encrypted_content")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string);
    if thinking.is_empty() && signature.is_none() {
        return None;
    }

    let mut block = serde_json::Map::new();
    block.insert("type".to_string(), Value::String("thinking".to_string()));
    block.insert("thinking".to_string(), Value::String(thinking));
    if let Some(signature) = signature {
        block.insert("signature".to_string(), Value::String(signature));
    }
    Some(Value::Object(block))
}

pub(super) fn extract_responses_reasoning_text(
    item_obj: &serde_json::Map<String, Value>,
) -> String {
    let content = collect_reasoning_text(item_obj.get("content"), true);
    if !content.is_empty() {
        return content;
    }
    collect_reasoning_text(item_obj.get("summary"), false)
}

fn collect_reasoning_text(value: Option<&Value>, content_mode: bool) -> String {
    let Some(items) = value.and_then(Value::as_array) else {
        return String::new();
    };

    let mut parts = Vec::new();
    for item in items {
        let Some(obj) = item.as_object() else {
            continue;
        };
        let item_type = obj.get("type").and_then(Value::as_str).unwrap_or_default();
        let type_matches = if content_mode {
            matches!(item_type, "reasoning_text" | "text")
        } else {
            matches!(item_type, "summary_text" | "text")
        };
        if !type_matches {
            continue;
        }
        let Some(text) = obj
            .get("text")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
        else {
            continue;
        };
        parts.push(text.to_string());
    }

    if content_mode {
        parts.join("")
    } else {
        parts.join("\n\n")
    }
}

fn extract_openai_text_content(value: &Value) -> Result<String, String> {
    if value.is_null() {
        return Ok(String::new());
    }
    if let Some(text) = value.as_str() {
        return Ok(text.to_string());
    }
    let Some(items) = value.as_array() else {
        return Err("unsupported upstream content format".to_string());
    };
    let mut parts = Vec::new();
    for item in items {
        let Some(item_obj) = item.as_object() else {
            continue;
        };
        if item_obj
            .get("type")
            .and_then(Value::as_str)
            .is_some_and(|kind| kind == "text")
        {
            if let Some(text) = item_obj.get("text").and_then(Value::as_str) {
                parts.push(text.to_string());
            }
        }
    }
    Ok(parts.join(""))
}

pub(super) fn parse_tool_arguments_as_object(raw: &str) -> Value {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return json!({});
    }
    let parsed = serde_json::from_str::<Value>(trimmed).ok();
    match parsed {
        Some(Value::Object(obj)) => Value::Object(obj),
        Some(Value::String(inner)) => {
            let nested = serde_json::from_str::<Value>(inner.trim()).ok();
            if let Some(Value::Object(obj)) = nested {
                Value::Object(obj)
            } else {
                json!({ "value": inner })
            }
        }
        Some(other) => json!({ "value": other }),
        None => json!({}),
    }
}

fn extract_function_call_input_object(item_obj: &serde_json::Map<String, Value>) -> Value {
    let Some(arguments_raw) = extract_function_call_arguments_raw(item_obj) else {
        return json!({});
    };
    parse_tool_arguments_as_object(&arguments_raw)
}

pub(super) fn extract_function_call_arguments_raw(
    item_obj: &serde_json::Map<String, Value>,
) -> Option<String> {
    const ARGUMENT_KEYS: [&str; 5] = [
        "arguments",
        "input",
        "arguments_json",
        "parsed_arguments",
        "args",
    ];
    for key in ARGUMENT_KEYS {
        let Some(value) = item_obj.get(key) else {
            continue;
        };
        if value.is_null() {
            continue;
        }
        if let Some(text) = value.as_str() {
            let trimmed = text.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
            continue;
        }
        if let Ok(serialized) = serde_json::to_string(value) {
            let trimmed = serialized.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }
    }
    None
}

pub(super) fn map_finish_reason(reason: &str) -> &'static str {
    match reason {
        "tool_calls" => "tool_use",
        "length" => "max_tokens",
        "stop" => "end_turn",
        _ => "end_turn",
    }
}
