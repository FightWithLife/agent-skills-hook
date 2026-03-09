use serde_json::{json, Value};
use std::collections::BTreeMap;
use std::io::{BufRead, BufReader, Cursor};

use super::{
    append_output_text_raw, collect_output_text_from_event_fields, collect_response_output_text,
    inspect_sse_frame, is_response_completed_event_name, merge_usage, parse_sse_frame_json,
    UpstreamResponseUsage,
};

#[derive(Debug, Clone, Default)]
struct ChatCompletionChoiceSynthesis {
    role: Option<String>,
    content: String,
    finish_reason: Option<Value>,
}

#[derive(Debug, Clone, Default)]
struct ChatCompletionSseSynthesis {
    id: Option<String>,
    model: Option<String>,
    created: Option<i64>,
    system_fingerprint: Option<Value>,
    usage: Option<Value>,
    choices: BTreeMap<i64, ChatCompletionChoiceSynthesis>,
    saw_terminal: bool,
}

#[derive(Debug, Clone, Default)]
struct ResponsesSseSynthesis {
    id: Option<String>,
    model: Option<String>,
    created: Option<i64>,
    usage: Option<Value>,
    output_text: String,
    saw_completed: bool,
}

fn append_chat_delta_content(buffer: &mut String, delta_content: &Value) {
    if let Some(text) = delta_content.as_str() {
        buffer.push_str(text);
        return;
    }
    let Some(parts) = delta_content.as_array() else {
        return;
    };
    for part in parts {
        if let Some(text) = part.get("text").and_then(Value::as_str) {
            buffer.push_str(text);
        }
    }
}

fn update_chat_completion_sse_synthesis(synthesis: &mut ChatCompletionSseSynthesis, value: &Value) {
    if value.get("object").and_then(Value::as_str) != Some("chat.completion.chunk") {
        return;
    }
    if synthesis.id.is_none() {
        synthesis.id = value
            .get("id")
            .and_then(Value::as_str)
            .map(|v| v.to_string());
    }
    if synthesis.model.is_none() {
        synthesis.model = value
            .get("model")
            .and_then(Value::as_str)
            .map(|v| v.to_string());
    }
    if synthesis.created.is_none() {
        synthesis.created = value.get("created").and_then(Value::as_i64);
    }
    if synthesis.system_fingerprint.is_none() {
        synthesis.system_fingerprint = value.get("system_fingerprint").cloned();
    }
    if let Some(usage) = value.get("usage") {
        synthesis.usage = Some(usage.clone());
    }

    let Some(choices) = value.get("choices").and_then(Value::as_array) else {
        return;
    };
    for (position, choice) in choices.iter().enumerate() {
        let index = choice
            .get("index")
            .and_then(Value::as_i64)
            .unwrap_or(position as i64);
        let target = synthesis.choices.entry(index).or_default();
        if target.role.is_none() {
            target.role = choice
                .get("delta")
                .and_then(|delta| delta.get("role"))
                .and_then(Value::as_str)
                .map(|v| v.to_string());
        }
        if let Some(delta_content) = choice.get("delta").and_then(|delta| delta.get("content")) {
            append_chat_delta_content(&mut target.content, delta_content);
        }
        if let Some(finish_reason) = choice.get("finish_reason") {
            if !finish_reason.is_null() {
                target.finish_reason = Some(finish_reason.clone());
                synthesis.saw_terminal = true;
            }
        }
    }
}

fn update_responses_sse_synthesis(synthesis: &mut ResponsesSseSynthesis, value: &Value) {
    let Some(event_type) = value.get("type").and_then(Value::as_str) else {
        return;
    };

    if synthesis.id.is_none() {
        synthesis.id = value
            .get("response_id")
            .and_then(Value::as_str)
            .map(str::to_string)
            .or_else(|| {
                value
                    .get("response")
                    .and_then(|response| response.get("id"))
                    .and_then(Value::as_str)
                    .map(str::to_string)
            })
            .or_else(|| value.get("id").and_then(Value::as_str).map(str::to_string));
    }
    if synthesis.model.is_none() {
        synthesis.model = value
            .get("model")
            .and_then(Value::as_str)
            .map(str::to_string)
            .or_else(|| {
                value
                    .get("response")
                    .and_then(|response| response.get("model"))
                    .and_then(Value::as_str)
                    .map(str::to_string)
            });
    }
    if synthesis.created.is_none() {
        synthesis.created = value
            .get("created")
            .and_then(Value::as_i64)
            .or_else(|| value.get("created_at").and_then(Value::as_i64))
            .or_else(|| {
                value
                    .get("response")
                    .and_then(|response| response.get("created"))
                    .and_then(Value::as_i64)
            })
            .or_else(|| {
                value
                    .get("response")
                    .and_then(|response| response.get("created_at"))
                    .and_then(Value::as_i64)
            });
    }

    if let Some(response_usage) = value
        .get("response")
        .and_then(|response| response.get("usage"))
        .cloned()
    {
        synthesis.usage = Some(response_usage);
    } else if synthesis.usage.is_none() {
        if let Some(usage) = value.get("usage").cloned() {
            synthesis.usage = Some(usage);
        }
    }

    let mut text_out = String::new();
    collect_output_text_from_event_fields(value, &mut text_out);
    if let Some(delta) = value.get("delta") {
        collect_response_output_text(delta, &mut text_out);
    }
    if let Some(response) = value.get("response") {
        collect_response_output_text(response, &mut text_out);
    }
    if !text_out.trim().is_empty() {
        append_output_text_raw(&mut synthesis.output_text, text_out.as_str());
    }

    if is_response_completed_event_name(event_type) {
        synthesis.saw_completed = true;
    }
}

fn response_has_effective_output(response: &Value) -> bool {
    let mut output_text = String::new();
    if let Some(output) = response.get("output") {
        collect_response_output_text(output, &mut output_text);
    }
    !output_text.trim().is_empty()
}

fn build_response_output_items_from_text(text: &str) -> Value {
    Value::Array(vec![json!({
        "type": "message",
        "role": "assistant",
        "content": [{
            "type": "output_text",
            "text": text
        }]
    })])
}

fn enrich_completed_response_with_sse_text(
    completed_response: Value,
    synthesis: &ResponsesSseSynthesis,
) -> Value {
    let mut response = completed_response;
    let Some(response_obj) = response.as_object_mut() else {
        return response;
    };

    if response_obj
        .get("id")
        .and_then(Value::as_str)
        .is_none_or(|id| id.is_empty())
    {
        if let Some(id) = synthesis.id.as_ref() {
            response_obj.insert("id".to_string(), Value::String(id.clone()));
        }
    }
    if response_obj
        .get("model")
        .and_then(Value::as_str)
        .is_none_or(|model| model.is_empty())
    {
        if let Some(model) = synthesis.model.as_ref() {
            response_obj.insert("model".to_string(), Value::String(model.clone()));
        }
    }
    if response_obj.get("created").and_then(Value::as_i64).is_none() {
        if let Some(created) = synthesis.created {
            response_obj.insert("created".to_string(), Value::Number(created.into()));
        }
    }
    if !response_obj.contains_key("object") {
        response_obj.insert("object".to_string(), Value::String("response".to_string()));
    }
    if !response_obj.contains_key("status") {
        response_obj.insert("status".to_string(), Value::String("completed".to_string()));
    }
    if response_obj.get("usage").is_none() {
        if let Some(usage) = synthesis.usage.as_ref() {
            response_obj.insert("usage".to_string(), usage.clone());
        }
    }

    let has_effective_output = response_has_effective_output(&Value::Object(response_obj.clone()));
    if !has_effective_output && !synthesis.output_text.trim().is_empty() {
        response_obj.insert(
            "output".to_string(),
            build_response_output_items_from_text(synthesis.output_text.as_str()),
        );
    }
    if response_obj
        .get("output_text")
        .and_then(Value::as_str)
        .is_none_or(|text| text.trim().is_empty())
        && !synthesis.output_text.trim().is_empty()
    {
        response_obj.insert(
            "output_text".to_string(),
            Value::String(synthesis.output_text.trim().to_string()),
        );
    }

    Value::Object(response_obj.clone())
}

fn synthesize_response_body_from_sse(synthesis: &ResponsesSseSynthesis) -> Option<Vec<u8>> {
    if !synthesis.saw_completed || synthesis.output_text.trim().is_empty() {
        return None;
    }
    let created = synthesis.created.unwrap_or_else(|| {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .ok()
            .map(|duration| duration.as_secs() as i64)
            .unwrap_or(0)
    });
    let mut out = serde_json::Map::new();
    out.insert(
        "id".to_string(),
        Value::String(
            synthesis
                .id
                .clone()
                .unwrap_or_else(|| "resp_proxy".to_string()),
        ),
    );
    out.insert("object".to_string(), Value::String("response".to_string()));
    out.insert("created".to_string(), Value::Number(created.into()));
    out.insert(
        "model".to_string(),
        Value::String(
            synthesis
                .model
                .clone()
                .unwrap_or_else(|| "gpt-5.3-codex".to_string()),
        ),
    );
    out.insert("status".to_string(), Value::String("completed".to_string()));
    out.insert(
        "output".to_string(),
        build_response_output_items_from_text(synthesis.output_text.trim()),
    );
    out.insert(
        "output_text".to_string(),
        Value::String(synthesis.output_text.trim().to_string()),
    );
    if let Some(usage) = synthesis.usage.clone() {
        out.insert("usage".to_string(), usage);
    }
    serde_json::to_vec(&Value::Object(out)).ok()
}

fn synthesize_chat_completion_body(synthesis: &ChatCompletionSseSynthesis) -> Option<Vec<u8>> {
    if !synthesis.saw_terminal || synthesis.choices.is_empty() {
        return None;
    }
    let created = synthesis.created.unwrap_or_else(|| {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .ok()
            .map(|duration| duration.as_secs() as i64)
            .unwrap_or(0)
    });

    let choices = synthesis
        .choices
        .iter()
        .map(|(index, choice)| {
            json!({
                "index": index,
                "message": {
                    "role": choice.role.clone().unwrap_or_else(|| "assistant".to_string()),
                    "content": choice.content,
                },
                "finish_reason": choice.finish_reason.clone().unwrap_or(Value::Null),
            })
        })
        .collect::<Vec<_>>();
    let mut out = serde_json::Map::new();
    out.insert(
        "id".to_string(),
        Value::String(
            synthesis
                .id
                .clone()
                .unwrap_or_else(|| "chatcmpl_proxy".to_string()),
        ),
    );
    out.insert(
        "object".to_string(),
        Value::String("chat.completion".to_string()),
    );
    out.insert("created".to_string(), Value::Number(created.into()));
    out.insert(
        "model".to_string(),
        Value::String(
            synthesis
                .model
                .clone()
                .unwrap_or_else(|| "gpt-5.3-codex".to_string()),
        ),
    );
    out.insert("choices".to_string(), Value::Array(choices));
    if let Some(system_fingerprint) = synthesis.system_fingerprint.clone() {
        out.insert("system_fingerprint".to_string(), system_fingerprint);
    }
    if let Some(usage) = synthesis.usage.clone() {
        out.insert("usage".to_string(), usage);
    }
    serde_json::to_vec(&Value::Object(out)).ok()
}

pub(super) fn collect_non_stream_json_from_sse_bytes(
    payload: &[u8],
) -> (Option<Vec<u8>>, UpstreamResponseUsage) {
    let mut usage = UpstreamResponseUsage::default();
    let mut completed_response: Option<Value> = None;
    let mut responses_sse_synthesis = ResponsesSseSynthesis::default();
    let mut chat_completion_synthesis = ChatCompletionSseSynthesis::default();
    let mut frame_lines: Vec<String> = Vec::new();

    let mut reader = BufReader::new(Cursor::new(payload));
    let mut line = String::new();
    loop {
        line.clear();
        let Ok(read) = reader.read_line(&mut line) else {
            break;
        };
        if read == 0 {
            break;
        }
        if line == "\n" || line == "\r\n" {
            if frame_lines.is_empty() {
                continue;
            }
            let frame = std::mem::take(&mut frame_lines);
            let inspection = inspect_sse_frame(&frame);
            if let Some(parsed_usage) = inspection.usage {
                merge_usage(&mut usage, parsed_usage);
            }
            if let Some(value) = parse_sse_frame_json(&frame) {
                update_responses_sse_synthesis(&mut responses_sse_synthesis, &value);
                update_chat_completion_sse_synthesis(&mut chat_completion_synthesis, &value);
                if value
                    .get("type")
                    .and_then(Value::as_str)
                    .is_some_and(is_response_completed_event_name)
                {
                    if let Some(response_obj) = value.get("response") {
                        completed_response = Some(response_obj.clone());
                    }
                }
            }
            continue;
        }
        frame_lines.push(line.clone());
    }

    if !frame_lines.is_empty() {
        let inspection = inspect_sse_frame(&frame_lines);
        if let Some(parsed_usage) = inspection.usage {
            merge_usage(&mut usage, parsed_usage);
        }
        if let Some(value) = parse_sse_frame_json(&frame_lines) {
            update_responses_sse_synthesis(&mut responses_sse_synthesis, &value);
            update_chat_completion_sse_synthesis(&mut chat_completion_synthesis, &value);
            if value
                .get("type")
                .and_then(Value::as_str)
                .is_some_and(is_response_completed_event_name)
            {
                if let Some(response_obj) = value.get("response") {
                    completed_response = Some(response_obj.clone());
                }
            }
        }
    }

    let body = completed_response
        .map(|value| enrich_completed_response_with_sse_text(value, &responses_sse_synthesis))
        .and_then(|value| serde_json::to_vec(&value).ok())
        .or_else(|| synthesize_response_body_from_sse(&responses_sse_synthesis))
        .or_else(|| synthesize_chat_completion_body(&chat_completion_synthesis));
    (body, usage)
}

pub(super) fn looks_like_sse_payload(body: &[u8]) -> bool {
    let Ok(text) = std::str::from_utf8(body) else {
        return false;
    };
    let mut saw_sse_prefix = false;
    for line in text.lines().take(32) {
        let trimmed = line.trim_start();
        if trimmed.is_empty() {
            if saw_sse_prefix {
                return true;
            }
            continue;
        }
        if trimmed.starts_with("data:") || trimmed.starts_with("event:") || trimmed.starts_with(':')
        {
            saw_sse_prefix = true;
            continue;
        }
        if !saw_sse_prefix {
            return false;
        }
    }
    saw_sse_prefix
}
