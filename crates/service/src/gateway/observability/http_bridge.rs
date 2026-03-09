use serde_json::{json, Map, Value};
use std::io::{BufRead, BufReader, Cursor, Read};
use std::sync::{Arc, Mutex};
use tiny_http::{Header, Request, Response, StatusCode};

use super::AccountInFlightGuard;

#[path = "http_bridge/output_text.rs"]
mod output_text;

use output_text::{
    append_output_text, append_output_text_raw, collect_output_text_from_event_fields,
    collect_response_output_text, extract_error_hint_from_body, merge_usage,
    parse_usage_from_json, reload_from_env as reload_output_text_from_env, usage_has_signal,
    UpstreamResponseBridgeResult, UpstreamResponseUsage,
};
#[cfg(test)]
use output_text::{output_text_limit_bytes, OUTPUT_TEXT_TRUNCATED_MARKER};

pub(super) fn reload_from_env() {
    reload_output_text_from_env();
}

fn push_trace_id_header(headers: &mut Vec<Header>, trace_id: &str) {
    let Some(trace_id) = Some(trace_id)
        .map(str::trim)
        .filter(|value| !value.is_empty())
    else {
        return;
    };
    if let Ok(header) = Header::from_bytes(
        crate::error_codes::TRACE_ID_HEADER_NAME.as_bytes(),
        trace_id.as_bytes(),
    ) {
        headers.push(header);
    }
}


#[path = "http_bridge/sse_frame.rs"]
mod sse_frame;

#[path = "http_bridge/openai_stream.rs"]
mod openai_stream;
#[path = "http_bridge/sse_aggregate.rs"]
mod sse_aggregate;

use sse_frame::{
    extract_sse_frame_payload, inspect_sse_frame, is_response_completed_event_name,
    parse_sse_frame_json, SseTerminal,
};
#[cfg(test)]
use sse_frame::parse_usage_from_sse_frame;
use openai_stream::{
    apply_openai_stream_meta_defaults, build_chat_fallback_content_chunk,
    build_completion_fallback_text_chunk, extract_openai_completed_output_text,
    map_chunk_has_chat_text, map_chunk_has_completion_text, normalize_chat_chunk_delta_role,
    should_skip_chat_live_text_event, should_skip_completion_live_text_event,
    synthesize_chat_completion_sse_from_json, synthesize_completions_sse_from_json,
    update_openai_stream_meta, OpenAIStreamMeta,
};
use sse_aggregate::{collect_non_stream_json_from_sse_bytes, looks_like_sse_payload};

pub(super) fn respond_with_upstream(
    request: Request,
    upstream: reqwest::blocking::Response,
    _inflight_guard: AccountInFlightGuard,
    response_adapter: super::ResponseAdapter,
    tool_name_restore_map: Option<&super::ToolNameRestoreMap>,
    is_stream: bool,
    trace_id: Option<&str>,
) -> Result<UpstreamResponseBridgeResult, String> {
    match response_adapter {
        super::ResponseAdapter::Passthrough => {
            let upstream_content_type = upstream
                .headers()
                .get(reqwest::header::CONTENT_TYPE)
                .and_then(|v| v.to_str().ok())
                .map(|v| v.to_string());
            let status = StatusCode(upstream.status().as_u16());
            let mut headers = Vec::new();
            for (name, value) in upstream.headers().iter() {
                let name_str = name.as_str();
                if name_str.eq_ignore_ascii_case("transfer-encoding")
                    || name_str.eq_ignore_ascii_case("content-length")
                    || name_str.eq_ignore_ascii_case("connection")
                {
                    continue;
                }
                if let Ok(header) = Header::from_bytes(name_str.as_bytes(), value.as_bytes()) {
                    headers.push(header);
                }
            }
            if let Some(trace_id) = trace_id {
                push_trace_id_header(&mut headers, trace_id);
            }
            let is_json = upstream_content_type
                .as_deref()
                .map(|value| value.to_ascii_lowercase().contains("application/json"))
                .unwrap_or(false);
            let is_sse = upstream_content_type
                .as_deref()
                .map(|value| value.to_ascii_lowercase().starts_with("text/event-stream"))
                .unwrap_or(false);
            if !is_stream {
                let upstream_body = upstream
                    .bytes()
                    .map_err(|err| format!("read upstream body failed: {err}"))?;
                let detected_sse =
                    is_sse || (!is_json && looks_like_sse_payload(upstream_body.as_ref()));
                if detected_sse {
                    let (synthesized_body, mut usage) =
                        collect_non_stream_json_from_sse_bytes(upstream_body.as_ref());
                    let synthesized_response = synthesized_body.is_some();
                    let body = synthesized_body.unwrap_or_else(|| upstream_body.to_vec());
                    if let Ok(value) = serde_json::from_slice::<Value>(&body) {
                        merge_usage(&mut usage, parse_usage_from_json(&value));
                    }
                    let upstream_error_hint = extract_error_hint_from_body(status.0, &body);
                    if synthesized_response {
                        headers.retain(|header| {
                            !header
                                .field
                                .as_str()
                                .as_str()
                                .eq_ignore_ascii_case("Content-Type")
                        });
                        if let Ok(content_type_header) = Header::from_bytes(
                            b"Content-Type".as_slice(),
                            b"application/json".as_slice(),
                        ) {
                            headers.push(content_type_header);
                        }
                    }
                    let len = Some(body.len());
                    let response =
                        Response::new(status, headers, std::io::Cursor::new(body), len, None);
                    let delivery_error = request.respond(response).err().map(|err| err.to_string());
                    return Ok(UpstreamResponseBridgeResult {
                        usage,
                        stream_terminal_seen: true,
                        stream_terminal_error: None,
                        delivery_error,
                        upstream_error_hint,
                    });
                }

                // 非 SSE 响应（即使客户端 stream=true）也按普通 body 回传，
                // 避免把 JSON 错误体按 SSE 解析导致 "stream disconnected before completion" 误报。
                let (_, sse_usage) = collect_non_stream_json_from_sse_bytes(upstream_body.as_ref());
                let usage = if is_json {
                    serde_json::from_slice::<Value>(upstream_body.as_ref())
                        .ok()
                        .map(|value| parse_usage_from_json(&value))
                        .unwrap_or_default()
                } else if usage_has_signal(&sse_usage) {
                    sse_usage
                } else {
                    UpstreamResponseUsage::default()
                };
                let upstream_error_hint =
                    extract_error_hint_from_body(status.0, upstream_body.as_ref());
                let len = Some(upstream_body.len());
                let response = Response::new(
                    status,
                    headers,
                    std::io::Cursor::new(upstream_body.to_vec()),
                    len,
                    None,
                );
                let delivery_error = request.respond(response).err().map(|err| err.to_string());
                return Ok(UpstreamResponseBridgeResult {
                    usage,
                    stream_terminal_seen: true,
                    stream_terminal_error: None,
                    delivery_error,
                    upstream_error_hint,
                });
            }
            if is_sse || is_stream {
                let usage_collector = Arc::new(Mutex::new(PassthroughSseCollector::default()));
                let response = Response::new(
                    status,
                    headers,
                    PassthroughSseUsageReader::new(upstream, Arc::clone(&usage_collector)),
                    None,
                    None,
                );
                let delivery_error = request.respond(response).err().map(|err| err.to_string());
                let collector = usage_collector
                    .lock()
                    .map(|guard| guard.clone())
                    .unwrap_or_default();
                return Ok(UpstreamResponseBridgeResult {
                    usage: collector.usage,
                    stream_terminal_seen: collector.saw_terminal,
                    stream_terminal_error: collector.terminal_error,
                    delivery_error,
                    upstream_error_hint: None,
                });
            }
            let len = upstream.content_length().map(|v| v as usize);
            let response = Response::new(status, headers, upstream, len, None);
            let delivery_error = request.respond(response).err().map(|err| err.to_string());
            Ok(UpstreamResponseBridgeResult {
                usage: UpstreamResponseUsage::default(),
                stream_terminal_seen: true,
                stream_terminal_error: None,
                delivery_error,
                upstream_error_hint: None,
            })
        }
        super::ResponseAdapter::OpenAIChatCompletionsJson
        | super::ResponseAdapter::OpenAIChatCompletionsSse
        | super::ResponseAdapter::OpenAICompletionsJson
        | super::ResponseAdapter::OpenAICompletionsSse => {
            let status = StatusCode(upstream.status().as_u16());
            let mut headers = Vec::new();
            for (name, value) in upstream.headers().iter() {
                let name_str = name.as_str();
                if name_str.eq_ignore_ascii_case("transfer-encoding")
                    || name_str.eq_ignore_ascii_case("content-length")
                    || name_str.eq_ignore_ascii_case("connection")
                    || name_str.eq_ignore_ascii_case("content-type")
                {
                    continue;
                }
                if let Ok(header) = Header::from_bytes(name_str.as_bytes(), value.as_bytes()) {
                    headers.push(header);
                }
            }
            if let Some(trace_id) = trace_id {
                push_trace_id_header(&mut headers, trace_id);
            }
            let upstream_content_type = upstream
                .headers()
                .get(reqwest::header::CONTENT_TYPE)
                .and_then(|v| v.to_str().ok())
                .map(|v| v.to_string());
            let is_sse = upstream_content_type
                .as_deref()
                .map(|value| value.to_ascii_lowercase().starts_with("text/event-stream"))
                .unwrap_or(false);
            let use_openai_sse_adapter = matches!(
                response_adapter,
                super::ResponseAdapter::OpenAIChatCompletionsSse
                    | super::ResponseAdapter::OpenAICompletionsSse
            );

            if use_openai_sse_adapter && is_stream && !is_sse {
                log::warn!(
                    "event=gateway_openai_stream_content_type_mismatch adapter={:?} upstream_content_type={}",
                    response_adapter,
                    upstream_content_type
                        .as_deref()
                        .filter(|value| !value.trim().is_empty())
                        .unwrap_or("-")
                );
            }

            if use_openai_sse_adapter && (is_stream || is_sse) && is_sse {
                if let Ok(content_type_header) =
                    Header::from_bytes(b"Content-Type".as_slice(), b"text/event-stream".as_slice())
                {
                    headers.push(content_type_header);
                }
                let usage_collector = Arc::new(Mutex::new(PassthroughSseCollector::default()));
                let delivery_error =
                    if response_adapter == super::ResponseAdapter::OpenAIChatCompletionsSse {
                        let response = Response::new(
                            status,
                            headers,
                            OpenAIChatCompletionsSseReader::new(
                                upstream,
                                Arc::clone(&usage_collector),
                                tool_name_restore_map.cloned(),
                            ),
                            None,
                            None,
                        );
                        request.respond(response).err().map(|err| err.to_string())
                    } else {
                        let response = Response::new(
                            status,
                            headers,
                            OpenAICompletionsSseReader::new(upstream, Arc::clone(&usage_collector)),
                            None,
                            None,
                        );
                        request.respond(response).err().map(|err| err.to_string())
                    };
                let collector = usage_collector
                    .lock()
                    .map(|guard| guard.clone())
                    .unwrap_or_default();
                let output_text_empty = collector
                    .usage
                    .output_text
                    .as_deref()
                    .map(str::trim)
                    .is_none_or(str::is_empty);
                if output_text_empty {
                    log::warn!(
                        "event=gateway_openai_stream_empty_output adapter={:?} terminal_seen={} terminal_error={} output_tokens={:?}",
                        response_adapter,
                        collector.saw_terminal,
                        collector.terminal_error.as_deref().unwrap_or("-"),
                        collector.usage.output_tokens
                    );
                }
                return Ok(UpstreamResponseBridgeResult {
                    usage: collector.usage,
                    stream_terminal_seen: collector.saw_terminal,
                    stream_terminal_error: collector.terminal_error,
                    delivery_error,
                    upstream_error_hint: None,
                });
            }

            let upstream_body = upstream
                .bytes()
                .map_err(|err| format!("read upstream body failed: {err}"))?;
            let mut usage = if is_sse {
                let (_, parsed) = collect_non_stream_json_from_sse_bytes(upstream_body.as_ref());
                parsed
            } else {
                UpstreamResponseUsage::default()
            };
            if let Ok(value) = serde_json::from_slice::<Value>(upstream_body.as_ref()) {
                merge_usage(&mut usage, parse_usage_from_json(&value));
            }
            let (mut body, mut content_type) = match super::adapt_upstream_response_with_tool_name_restore_map(
                response_adapter,
                upstream_content_type.as_deref(),
                upstream_body.as_ref(),
                tool_name_restore_map,
            ) {
                Ok(result) => result,
                Err(err) => (
                    serde_json::to_vec(&json!({
                        "error": {
                            "message": format!("response conversion failed: {err}"),
                            "type": "server_error"
                        }
                    }))
                    .unwrap_or_else(|_| {
                        b"{\"error\":{\"message\":\"response conversion failed\",\"type\":\"server_error\"}}"
                            .to_vec()
                    }),
                    "application/json",
                ),
            };
            if use_openai_sse_adapter
                && is_stream
                && status.0 < 400
                && !content_type.eq_ignore_ascii_case("text/event-stream")
            {
                if let Ok(mapped_json) = serde_json::from_slice::<Value>(body.as_ref()) {
                    merge_usage(&mut usage, parse_usage_from_json(&mapped_json));
                    body = if response_adapter == super::ResponseAdapter::OpenAIChatCompletionsSse {
                        synthesize_chat_completion_sse_from_json(&mapped_json)
                    } else {
                        synthesize_completions_sse_from_json(&mapped_json)
                    };
                    content_type = "text/event-stream";
                    log::warn!(
                        "event=gateway_openai_stream_synthetic_sse adapter={:?} status={} upstream_content_type={}",
                        response_adapter,
                        status.0,
                        upstream_content_type
                            .as_deref()
                            .filter(|value| !value.trim().is_empty())
                            .unwrap_or("-")
                    );
                }
            }
            if let Ok(content_type_header) =
                Header::from_bytes(b"Content-Type".as_slice(), content_type.as_bytes())
            {
                headers.push(content_type_header);
            }
            let len = Some(body.len());
            let response = Response::new(status, headers, std::io::Cursor::new(body), len, None);
            let delivery_error = request.respond(response).err().map(|err| err.to_string());
            let upstream_error_hint =
                extract_error_hint_from_body(status.0, upstream_body.as_ref());
            Ok(UpstreamResponseBridgeResult {
                usage,
                stream_terminal_seen: true,
                stream_terminal_error: None,
                delivery_error,
                upstream_error_hint,
            })
        }
        super::ResponseAdapter::AnthropicJson | super::ResponseAdapter::AnthropicSse => {
            let status = StatusCode(upstream.status().as_u16());
            let mut headers = Vec::new();
            for (name, value) in upstream.headers().iter() {
                let name_str = name.as_str();
                if name_str.eq_ignore_ascii_case("transfer-encoding")
                    || name_str.eq_ignore_ascii_case("content-length")
                    || name_str.eq_ignore_ascii_case("connection")
                    || name_str.eq_ignore_ascii_case("content-type")
                {
                    continue;
                }
                if let Ok(header) = Header::from_bytes(name_str.as_bytes(), value.as_bytes()) {
                    headers.push(header);
                }
            }
            if let Some(trace_id) = trace_id {
                push_trace_id_header(&mut headers, trace_id);
            }
            let upstream_content_type = upstream
                .headers()
                .get(reqwest::header::CONTENT_TYPE)
                .and_then(|v| v.to_str().ok())
                .map(|v| v.to_string());

            if response_adapter == super::ResponseAdapter::AnthropicSse
                && (is_stream
                    || upstream_content_type
                        .as_deref()
                        .map(|value| value.to_ascii_lowercase().starts_with("text/event-stream"))
                        .unwrap_or(false))
            {
                if let Ok(content_type_header) =
                    Header::from_bytes(b"Content-Type".as_slice(), b"text/event-stream".as_slice())
                {
                    headers.push(content_type_header);
                }
                let usage_collector = Arc::new(Mutex::new(UpstreamResponseUsage::default()));
                let response = Response::new(
                    status,
                    headers,
                    AnthropicSseReader::new(upstream, Arc::clone(&usage_collector)),
                    None,
                    None,
                );
                let delivery_error = request.respond(response).err().map(|err| err.to_string());
                let usage = usage_collector
                    .lock()
                    .map(|guard| guard.clone())
                    .unwrap_or_default();
                return Ok(UpstreamResponseBridgeResult {
                    usage,
                    stream_terminal_seen: true,
                    stream_terminal_error: None,
                    delivery_error,
                    upstream_error_hint: None,
                });
            }

            let upstream_body = upstream
                .bytes()
                .map_err(|err| format!("read upstream body failed: {err}"))?;
            let usage = serde_json::from_slice::<Value>(upstream_body.as_ref())
                .ok()
                .map(|value| parse_usage_from_json(&value))
                .unwrap_or_default();

            let (body, content_type) = match super::adapt_upstream_response(
                response_adapter,
                upstream_content_type.as_deref(),
                upstream_body.as_ref(),
            ) {
                Ok(result) => result,
                Err(err) => (
                    super::build_anthropic_error_body(&format!(
                        "response conversion failed: {err}"
                    )),
                    "application/json",
                ),
            };
            if let Ok(content_type_header) =
                Header::from_bytes(b"Content-Type".as_slice(), content_type.as_bytes())
            {
                headers.push(content_type_header);
            }

            let len = Some(body.len());
            let response = Response::new(status, headers, std::io::Cursor::new(body), len, None);
            let delivery_error = request.respond(response).err().map(|err| err.to_string());
            let upstream_error_hint =
                extract_error_hint_from_body(status.0, upstream_body.as_ref());
            Ok(UpstreamResponseBridgeResult {
                usage,
                stream_terminal_seen: true,
                stream_terminal_error: None,
                delivery_error,
                upstream_error_hint,
            })
        }
    }
}

#[derive(Debug, Clone, Default)]
struct PassthroughSseCollector {
    usage: UpstreamResponseUsage,
    saw_terminal: bool,
    terminal_error: Option<String>,
}

fn collector_output_text_trimmed(
    usage_collector: &Arc<Mutex<PassthroughSseCollector>>,
) -> Option<String> {
    usage_collector
        .lock()
        .ok()
        .and_then(|collector| collector.usage.output_text.clone())
        .map(|text| text.trim().to_string())
        .filter(|text| !text.is_empty())
}

fn mark_collector_terminal_success(usage_collector: &Arc<Mutex<PassthroughSseCollector>>) {
    if let Ok(mut collector) = usage_collector.lock() {
        collector.saw_terminal = true;
        collector.terminal_error = None;
    }
}

struct PassthroughSseUsageReader {
    upstream: BufReader<reqwest::blocking::Response>,
    pending_frame_lines: Vec<String>,
    out_cursor: Cursor<Vec<u8>>,
    usage_collector: Arc<Mutex<PassthroughSseCollector>>,
    finished: bool,
}

impl PassthroughSseUsageReader {
    fn new(
        upstream: reqwest::blocking::Response,
        usage_collector: Arc<Mutex<PassthroughSseCollector>>,
    ) -> Self {
        Self {
            upstream: BufReader::new(upstream),
            pending_frame_lines: Vec::new(),
            out_cursor: Cursor::new(Vec::new()),
            usage_collector,
            finished: false,
        }
    }

    fn update_usage_from_frame(&self, lines: &[String]) {
        let inspection = inspect_sse_frame(lines);
        if inspection.usage.is_none() && inspection.terminal.is_none() {
            return;
        }
        if let Ok(mut collector) = self.usage_collector.lock() {
            if let Some(parsed) = inspection.usage {
                merge_usage(&mut collector.usage, parsed);
            }
            if let Some(terminal) = inspection.terminal {
                collector.saw_terminal = true;
                if let SseTerminal::Err(message) = terminal {
                    collector.terminal_error = Some(message);
                }
            }
        }
    }

    fn next_chunk(&mut self) -> std::io::Result<Vec<u8>> {
        let mut line = String::new();
        let read = self.upstream.read_line(&mut line)?;
        if read == 0 {
            if !self.pending_frame_lines.is_empty() {
                let frame = std::mem::take(&mut self.pending_frame_lines);
                self.update_usage_from_frame(&frame);
            }
            if let Ok(mut collector) = self.usage_collector.lock() {
                if !collector.saw_terminal {
                    collector
                        .terminal_error
                        .get_or_insert_with(|| "stream disconnected before completion".to_string());
                }
            }
            self.finished = true;
            return Ok(Vec::new());
        }
        if line == "\n" || line == "\r\n" {
            if !self.pending_frame_lines.is_empty() {
                let frame = std::mem::take(&mut self.pending_frame_lines);
                self.update_usage_from_frame(&frame);
            }
        } else {
            self.pending_frame_lines.push(line.clone());
        }
        Ok(line.into_bytes())
    }
}

impl Read for PassthroughSseUsageReader {
    fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
        loop {
            let read = self.out_cursor.read(buf)?;
            if read > 0 {
                return Ok(read);
            }
            if self.finished {
                return Ok(0);
            }
            self.out_cursor = Cursor::new(self.next_chunk()?);
        }
    }
}

struct OpenAICompletionsSseReader {
    upstream: BufReader<reqwest::blocking::Response>,
    pending_frame_lines: Vec<String>,
    out_cursor: Cursor<Vec<u8>>,
    usage_collector: Arc<Mutex<PassthroughSseCollector>>,
    stream_meta: OpenAIStreamMeta,
    emitted_text_delta: bool,
    finished: bool,
}

impl OpenAICompletionsSseReader {
    fn new(
        upstream: reqwest::blocking::Response,
        usage_collector: Arc<Mutex<PassthroughSseCollector>>,
    ) -> Self {
        Self {
            upstream: BufReader::new(upstream),
            pending_frame_lines: Vec::new(),
            out_cursor: Cursor::new(Vec::new()),
            usage_collector,
            stream_meta: OpenAIStreamMeta::default(),
            emitted_text_delta: false,
            finished: false,
        }
    }

    fn update_usage_from_frame(&self, lines: &[String]) {
        let inspection = inspect_sse_frame(lines);
        if inspection.usage.is_none() && inspection.terminal.is_none() {
            return;
        }
        if let Ok(mut collector) = self.usage_collector.lock() {
            if let Some(parsed) = inspection.usage {
                merge_usage(&mut collector.usage, parsed);
            }
            if let Some(terminal) = inspection.terminal {
                collector.saw_terminal = true;
                if let SseTerminal::Err(message) = terminal {
                    collector.terminal_error = Some(message);
                }
            }
        }
    }

    fn try_build_completion_fallback_stream(&mut self, include_done: bool) -> Option<Vec<u8>> {
        if self.emitted_text_delta {
            return None;
        }
        let fallback_text = collector_output_text_trimmed(&self.usage_collector)?;
        let mut fallback_chunk =
            build_completion_fallback_text_chunk(&self.stream_meta, fallback_text.as_str());
        apply_openai_stream_meta_defaults(&mut fallback_chunk, &self.stream_meta);
        let payload = serde_json::to_string(&fallback_chunk).unwrap_or_else(|_| "{}".to_string());
        let mut out = format!("data: {payload}\n\n");
        self.emitted_text_delta = true;
        if include_done {
            out.push_str("data: [DONE]\n\n");
            self.finished = true;
        }
        mark_collector_terminal_success(&self.usage_collector);
        Some(out.into_bytes())
    }

    fn map_frame_to_completions_sse(&mut self, lines: &[String]) -> Vec<u8> {
        let Some(data) = extract_sse_frame_payload(lines) else {
            return Vec::new();
        };
        if data.trim() == "[DONE]" {
            if let Some(fallback) = self.try_build_completion_fallback_stream(true) {
                return fallback;
            }
            self.finished = true;
            return b"data: [DONE]\n\n".to_vec();
        }

        let Some(value) = parse_sse_frame_json(lines) else {
            return Vec::new();
        };
        update_openai_stream_meta(&mut self.stream_meta, &value);
        let event_type = value
            .get("type")
            .and_then(Value::as_str)
            .unwrap_or_default();
        if event_type == "response.created" {
            return Vec::new();
        }

        let mut out = String::new();
        if is_response_completed_event_name(event_type) && !self.emitted_text_delta {
            if let Some(fallback_text) = extract_openai_completed_output_text(&value) {
                let mut fallback_chunk =
                    build_completion_fallback_text_chunk(&self.stream_meta, fallback_text.as_str());
                apply_openai_stream_meta_defaults(&mut fallback_chunk, &self.stream_meta);
                let payload =
                    serde_json::to_string(&fallback_chunk).unwrap_or_else(|_| "{}".to_string());
                out.push_str(format!("data: {payload}\n\n").as_str());
                self.emitted_text_delta = true;
            }
        }

        if should_skip_completion_live_text_event(event_type, &value) {
            return out.into_bytes();
        }

        if let Some(mut mapped) = super::convert_openai_completions_stream_chunk(&value) {
            apply_openai_stream_meta_defaults(&mut mapped, &self.stream_meta);
            if map_chunk_has_completion_text(&mapped) {
                self.emitted_text_delta = true;
            }
            let payload = serde_json::to_string(&mapped).unwrap_or_else(|_| "{}".to_string());
            out.push_str(format!("data: {payload}\n\n").as_str());
        }

        if is_response_completed_event_name(event_type) {
            out.push_str("data: [DONE]\n\n");
            self.finished = true;
        }

        out.into_bytes()
    }

    fn next_chunk(&mut self) -> std::io::Result<Vec<u8>> {
        let mut line = String::new();
        loop {
            line.clear();
            let read = self.upstream.read_line(&mut line)?;
            if read == 0 {
                if !self.pending_frame_lines.is_empty() {
                    let frame = std::mem::take(&mut self.pending_frame_lines);
                    self.update_usage_from_frame(&frame);
                    let mapped = self.map_frame_to_completions_sse(&frame);
                    if !mapped.is_empty() {
                        return Ok(mapped);
                    }
                }
                if let Some(fallback) = self.try_build_completion_fallback_stream(true) {
                    return Ok(fallback);
                }
                if let Ok(mut collector) = self.usage_collector.lock() {
                    if !collector.saw_terminal {
                        // 中文注释：对齐最新 Codex SSE 语义：
                        // 仅凭已收到文本不足以判定成功，必须等到真正 terminal 事件。
                        collector.terminal_error.get_or_insert_with(|| {
                            "stream disconnected before completion".to_string()
                        });
                    }
                }
                self.finished = true;
                return Ok(Vec::new());
            }
            if line == "\n" || line == "\r\n" {
                if self.pending_frame_lines.is_empty() {
                    continue;
                }
                let frame = std::mem::take(&mut self.pending_frame_lines);
                self.update_usage_from_frame(&frame);
                let mapped = self.map_frame_to_completions_sse(&frame);
                if !mapped.is_empty() {
                    return Ok(mapped);
                }
                continue;
            }
            self.pending_frame_lines.push(line.clone());
        }
    }
}

impl Read for OpenAICompletionsSseReader {
    fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
        loop {
            let read = self.out_cursor.read(buf)?;
            if read > 0 {
                return Ok(read);
            }
            if self.finished {
                return Ok(0);
            }
            self.out_cursor = Cursor::new(self.next_chunk()?);
        }
    }
}

struct OpenAIChatCompletionsSseReader {
    upstream: BufReader<reqwest::blocking::Response>,
    pending_frame_lines: Vec<String>,
    out_cursor: Cursor<Vec<u8>>,
    usage_collector: Arc<Mutex<PassthroughSseCollector>>,
    tool_name_restore_map: Option<super::ToolNameRestoreMap>,
    stream_meta: OpenAIStreamMeta,
    emitted_text_delta: bool,
    emitted_assistant_role: bool,
    finished: bool,
}

impl OpenAIChatCompletionsSseReader {
    fn new(
        upstream: reqwest::blocking::Response,
        usage_collector: Arc<Mutex<PassthroughSseCollector>>,
        tool_name_restore_map: Option<super::ToolNameRestoreMap>,
    ) -> Self {
        Self {
            upstream: BufReader::new(upstream),
            pending_frame_lines: Vec::new(),
            out_cursor: Cursor::new(Vec::new()),
            usage_collector,
            tool_name_restore_map,
            stream_meta: OpenAIStreamMeta::default(),
            emitted_text_delta: false,
            emitted_assistant_role: false,
            finished: false,
        }
    }

    fn update_usage_from_frame(&self, lines: &[String]) {
        let inspection = inspect_sse_frame(lines);
        if inspection.usage.is_none() && inspection.terminal.is_none() {
            return;
        }
        if let Ok(mut collector) = self.usage_collector.lock() {
            if let Some(parsed) = inspection.usage {
                merge_usage(&mut collector.usage, parsed);
            }
            if let Some(terminal) = inspection.terminal {
                collector.saw_terminal = true;
                if let SseTerminal::Err(message) = terminal {
                    collector.terminal_error = Some(message);
                }
            }
        }
    }

    fn try_build_chat_fallback_stream(&mut self, include_done: bool) -> Option<Vec<u8>> {
        if self.emitted_text_delta {
            return None;
        }
        let fallback_content = collector_output_text_trimmed(&self.usage_collector)?;
        let mut fallback_chunk =
            build_chat_fallback_content_chunk(&self.stream_meta, fallback_content.as_str());
        apply_openai_stream_meta_defaults(&mut fallback_chunk, &self.stream_meta);
        normalize_chat_chunk_delta_role(&mut fallback_chunk, &mut self.emitted_assistant_role);
        let payload = serde_json::to_string(&fallback_chunk).unwrap_or_else(|_| "{}".to_string());
        let mut out = format!("data: {payload}\n\n");
        self.emitted_text_delta = true;
        if include_done {
            out.push_str("data: [DONE]\n\n");
            self.finished = true;
        }
        mark_collector_terminal_success(&self.usage_collector);
        Some(out.into_bytes())
    }

    fn map_frame_to_chat_completions_sse(&mut self, lines: &[String]) -> Vec<u8> {
        let Some(data) = extract_sse_frame_payload(lines) else {
            return Vec::new();
        };
        if data.trim() == "[DONE]" {
            if let Some(fallback) = self.try_build_chat_fallback_stream(true) {
                return fallback;
            }
            self.finished = true;
            return b"data: [DONE]\n\n".to_vec();
        }

        let Some(value) = parse_sse_frame_json(lines) else {
            return Vec::new();
        };
        update_openai_stream_meta(&mut self.stream_meta, &value);
        let event_type = value
            .get("type")
            .and_then(Value::as_str)
            .unwrap_or_default();
        if event_type == "response.created" {
            return Vec::new();
        }

        let mut out = String::new();
        if is_response_completed_event_name(event_type) && !self.emitted_text_delta {
            if let Some(fallback_content) = extract_openai_completed_output_text(&value) {
                let mut fallback_chunk =
                    build_chat_fallback_content_chunk(&self.stream_meta, fallback_content.as_str());
                apply_openai_stream_meta_defaults(&mut fallback_chunk, &self.stream_meta);
                normalize_chat_chunk_delta_role(
                    &mut fallback_chunk,
                    &mut self.emitted_assistant_role,
                );
                let payload =
                    serde_json::to_string(&fallback_chunk).unwrap_or_else(|_| "{}".to_string());
                out.push_str(format!("data: {payload}\n\n").as_str());
                self.emitted_text_delta = true;
            }
        }

        if should_skip_chat_live_text_event(event_type, &value) {
            return out.into_bytes();
        }

        if let Some(mut mapped) = super::convert_openai_chat_stream_chunk_with_tool_name_restore_map(
            &value,
            self.tool_name_restore_map.as_ref(),
        ) {
            apply_openai_stream_meta_defaults(&mut mapped, &self.stream_meta);
            normalize_chat_chunk_delta_role(&mut mapped, &mut self.emitted_assistant_role);
            if map_chunk_has_chat_text(&mapped) {
                self.emitted_text_delta = true;
            }
            let payload = serde_json::to_string(&mapped).unwrap_or_else(|_| "{}".to_string());
            out.push_str(format!("data: {payload}\n\n").as_str());
        }

        if is_response_completed_event_name(event_type) {
            out.push_str("data: [DONE]\n\n");
            self.finished = true;
        }

        out.into_bytes()
    }

    fn next_chunk(&mut self) -> std::io::Result<Vec<u8>> {
        let mut line = String::new();
        loop {
            line.clear();
            let read = self.upstream.read_line(&mut line)?;
            if read == 0 {
                if !self.pending_frame_lines.is_empty() {
                    let frame = std::mem::take(&mut self.pending_frame_lines);
                    self.update_usage_from_frame(&frame);
                    let mapped = self.map_frame_to_chat_completions_sse(&frame);
                    if !mapped.is_empty() {
                        return Ok(mapped);
                    }
                }
                if let Some(fallback) = self.try_build_chat_fallback_stream(true) {
                    return Ok(fallback);
                }
                if let Ok(mut collector) = self.usage_collector.lock() {
                    if !collector.saw_terminal {
                        // 中文注释：对齐最新 Codex SSE 语义：
                        // 只有 response.completed / response.done / [DONE] 才算正常结束。
                        collector.terminal_error.get_or_insert_with(|| {
                            "stream disconnected before completion".to_string()
                        });
                    }
                }
                self.finished = true;
                return Ok(Vec::new());
            }
            if line == "\n" || line == "\r\n" {
                if self.pending_frame_lines.is_empty() {
                    continue;
                }
                let frame = std::mem::take(&mut self.pending_frame_lines);
                self.update_usage_from_frame(&frame);
                let mapped = self.map_frame_to_chat_completions_sse(&frame);
                if !mapped.is_empty() {
                    return Ok(mapped);
                }
                continue;
            }
            self.pending_frame_lines.push(line.clone());
        }
    }
}

impl Read for OpenAIChatCompletionsSseReader {
    fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
        loop {
            let read = self.out_cursor.read(buf)?;
            if read > 0 {
                return Ok(read);
            }
            if self.finished {
                return Ok(0);
            }
            self.out_cursor = Cursor::new(self.next_chunk()?);
        }
    }
}

struct AnthropicSseReader {
    upstream: BufReader<reqwest::blocking::Response>,
    pending_frame_lines: Vec<String>,
    out_cursor: Cursor<Vec<u8>>,
    state: AnthropicSseState,
    usage_collector: Arc<Mutex<UpstreamResponseUsage>>,
}

#[derive(Default)]
struct AnthropicSseState {
    started: bool,
    finished: bool,
    text_block_index: Option<usize>,
    next_block_index: usize,
    response_id: Option<String>,
    model: Option<String>,
    input_tokens: i64,
    cached_input_tokens: i64,
    output_tokens: i64,
    total_tokens: Option<i64>,
    reasoning_output_tokens: i64,
    output_text: String,
    stop_reason: Option<&'static str>,
}

impl AnthropicSseReader {
    fn new(
        upstream: reqwest::blocking::Response,
        usage_collector: Arc<Mutex<UpstreamResponseUsage>>,
    ) -> Self {
        Self {
            upstream: BufReader::new(upstream),
            pending_frame_lines: Vec::new(),
            out_cursor: Cursor::new(Vec::new()),
            state: AnthropicSseState::default(),
            usage_collector,
        }
    }

    fn next_chunk(&mut self) -> std::io::Result<Vec<u8>> {
        let mut line = String::new();
        loop {
            line.clear();
            let read = self.upstream.read_line(&mut line)?;
            if read == 0 {
                return Ok(self.finish_stream());
            }
            if line == "\n" || line == "\r\n" {
                let frame = std::mem::take(&mut self.pending_frame_lines);
                let mapped = self.process_sse_frame(&frame);
                if !mapped.is_empty() {
                    return Ok(mapped);
                }
                continue;
            }
            self.pending_frame_lines.push(line.clone());
        }
    }

    fn process_sse_frame(&mut self, lines: &[String]) -> Vec<u8> {
        let mut data_lines = Vec::new();
        for line in lines {
            let trimmed = line.trim_end_matches(['\r', '\n']);
            if let Some(rest) = trimmed.strip_prefix("data:") {
                data_lines.push(rest.trim_start().to_string());
            }
        }
        if data_lines.is_empty() {
            return Vec::new();
        }
        let data = data_lines.join("\n");
        if data.trim() == "[DONE]" {
            return self.finish_stream();
        }

        let value = match serde_json::from_str::<Value>(&data) {
            Ok(value) => value,
            Err(_) => return Vec::new(),
        };
        self.consume_openai_event(&value)
    }

    fn consume_openai_event(&mut self, value: &Value) -> Vec<u8> {
        self.capture_response_meta(value);
        let mut out = String::new();
        let Some(event_type) = value.get("type").and_then(Value::as_str) else {
            return Vec::new();
        };
        match event_type {
            "response.output_text.delta" => {
                let fragment = value
                    .get("delta")
                    .and_then(Value::as_str)
                    .unwrap_or_default();
                if fragment.is_empty() {
                    return Vec::new();
                }
                append_output_text(&mut self.state.output_text, fragment);
                self.ensure_message_start(&mut out);
                self.ensure_text_block_start(&mut out);
                let text_index = self.state.text_block_index.unwrap_or(0);
                append_sse_event(
                    &mut out,
                    "content_block_delta",
                    &json!({
                        "type": "content_block_delta",
                        "index": text_index,
                        "delta": {
                            "type": "text_delta",
                            "text": fragment
                        }
                    }),
                );
                self.state.stop_reason.get_or_insert("end_turn");
            }
            "response.output_item.done" => {
                collect_output_text_from_event_fields(value, &mut self.state.output_text);
                let Some(item_obj) = value
                    .get("item")
                    .or_else(|| value.get("output_item"))
                    .and_then(Value::as_object)
                else {
                    return Vec::new();
                };
                if item_obj
                    .get("type")
                    .and_then(Value::as_str)
                    .is_none_or(|kind| kind != "function_call")
                {
                    return Vec::new();
                }
                self.ensure_message_start(&mut out);
                self.close_text_block(&mut out);
                let block_index = self.state.next_block_index;
                self.state.next_block_index = self.state.next_block_index.saturating_add(1);
                let tool_use_id = item_obj
                    .get("call_id")
                    .or_else(|| item_obj.get("id"))
                    .and_then(Value::as_str)
                    .unwrap_or("toolu_unknown");
                let tool_name = item_obj
                    .get("name")
                    .and_then(Value::as_str)
                    .unwrap_or("tool");
                append_sse_event(
                    &mut out,
                    "content_block_start",
                    &json!({
                        "type": "content_block_start",
                        "index": block_index,
                        "content_block": {
                            "type": "tool_use",
                            "id": tool_use_id,
                            "name": tool_name,
                            "input": {}
                        }
                    }),
                );
                if let Some(partial_json) =
                    extract_function_call_input(item_obj).and_then(tool_input_partial_json)
                {
                    append_sse_event(
                        &mut out,
                        "content_block_delta",
                        &json!({
                            "type": "content_block_delta",
                            "index": block_index,
                            "delta": {
                                "type": "input_json_delta",
                                "partial_json": partial_json,
                            }
                        }),
                    );
                }
                append_sse_event(
                    &mut out,
                    "content_block_stop",
                    &json!({
                        "type": "content_block_stop",
                        "index": block_index
                    }),
                );
                self.state.stop_reason = Some("tool_use");
            }
            _ if event_type.starts_with("response.output_item.")
                || event_type.starts_with("response.content_part.") =>
            {
                collect_output_text_from_event_fields(value, &mut self.state.output_text);
            }
            "response.completed" | "response.done" => {
                if let Some(response) = value.get("response") {
                    let mut extracted_output_text = String::new();
                    collect_response_output_text(response, &mut extracted_output_text);
                    if !extracted_output_text.trim().is_empty() {
                        // 若已在流式过程中发过文本增量，不再重复把 completed 全文再发一遍。
                        if self.state.text_block_index.is_none() {
                            append_output_text(
                                &mut self.state.output_text,
                                extracted_output_text.as_str(),
                            );
                            self.ensure_message_start(&mut out);
                            self.ensure_text_block_start(&mut out);
                            let text_index = self.state.text_block_index.unwrap_or(0);
                            append_sse_event(
                                &mut out,
                                "content_block_delta",
                                &json!({
                                    "type": "content_block_delta",
                                    "index": text_index,
                                    "delta": {
                                        "type": "text_delta",
                                        "text": extracted_output_text
                                    }
                                }),
                            );
                        }
                        self.state.stop_reason.get_or_insert("end_turn");
                    }
                }
            }
            _ => {}
        }
        out.into_bytes()
    }

    fn capture_response_meta(&mut self, value: &Value) {
        if let Some(id) = value.get("id").and_then(Value::as_str) {
            self.state.response_id = Some(id.to_string());
        }
        if let Some(model) = value.get("model").and_then(Value::as_str) {
            self.state.model = Some(model.to_string());
        }
        if let Some(response) = value.get("response").and_then(Value::as_object) {
            if let Some(id) = response.get("id").and_then(Value::as_str) {
                self.state.response_id = Some(id.to_string());
            }
            if let Some(model) = response.get("model").and_then(Value::as_str) {
                self.state.model = Some(model.to_string());
            }
            if let Some(usage) = response.get("usage").and_then(Value::as_object) {
                self.state.input_tokens = usage
                    .get("input_tokens")
                    .and_then(Value::as_i64)
                    .or_else(|| usage.get("prompt_tokens").and_then(Value::as_i64))
                    .unwrap_or(self.state.input_tokens);
                self.state.cached_input_tokens = usage
                    .get("input_tokens_details")
                    .and_then(Value::as_object)
                    .and_then(|details| details.get("cached_tokens"))
                    .and_then(Value::as_i64)
                    .or_else(|| {
                        usage
                            .get("prompt_tokens_details")
                            .and_then(Value::as_object)
                            .and_then(|details| details.get("cached_tokens"))
                            .and_then(Value::as_i64)
                    })
                    .unwrap_or(self.state.cached_input_tokens);
                self.state.output_tokens = usage
                    .get("output_tokens")
                    .and_then(Value::as_i64)
                    .or_else(|| usage.get("completion_tokens").and_then(Value::as_i64))
                    .unwrap_or(self.state.output_tokens);
                self.state.total_tokens = usage
                    .get("total_tokens")
                    .and_then(Value::as_i64)
                    .or(self.state.total_tokens);
                self.state.reasoning_output_tokens = usage
                    .get("output_tokens_details")
                    .and_then(Value::as_object)
                    .and_then(|details| details.get("reasoning_tokens"))
                    .and_then(Value::as_i64)
                    .or_else(|| {
                        usage
                            .get("completion_tokens_details")
                            .and_then(Value::as_object)
                            .and_then(|details| details.get("reasoning_tokens"))
                            .and_then(Value::as_i64)
                    })
                    .unwrap_or(self.state.reasoning_output_tokens);
            }
        }
    }

    fn ensure_message_start(&mut self, out: &mut String) {
        if self.state.started {
            return;
        }
        self.state.started = true;
        append_sse_event(
            out,
            "message_start",
            &json!({
                "type": "message_start",
                "message": {
                    "id": self.state.response_id.clone().unwrap_or_else(|| "msg_proxy".to_string()),
                    "type": "message",
                    "role": "assistant",
                    "model": self.state.model.clone().unwrap_or_else(|| "gpt-5.3-codex".to_string()),
                    "content": [],
                    "stop_reason": Value::Null,
                    "stop_sequence": Value::Null,
                    "usage": {
                        "input_tokens": self.state.input_tokens.max(0),
                        "output_tokens": 0
                    }
                }
            }),
        );
    }

    fn ensure_text_block_start(&mut self, out: &mut String) {
        if self.state.text_block_index.is_some() {
            return;
        }
        let index = self.state.next_block_index;
        self.state.next_block_index = self.state.next_block_index.saturating_add(1);
        self.state.text_block_index = Some(index);
        append_sse_event(
            out,
            "content_block_start",
            &json!({
                "type": "content_block_start",
                "index": index,
                "content_block": {
                    "type": "text",
                    "text": ""
                }
            }),
        );
    }

    fn close_text_block(&mut self, out: &mut String) {
        let Some(index) = self.state.text_block_index.take() else {
            return;
        };
        append_sse_event(
            out,
            "content_block_stop",
            &json!({
                "type": "content_block_stop",
                "index": index
            }),
        );
    }

    fn finish_stream(&mut self) -> Vec<u8> {
        if self.state.finished {
            return Vec::new();
        }
        self.state.finished = true;
        if let Ok(mut usage) = self.usage_collector.lock() {
            usage.input_tokens = Some(self.state.input_tokens.max(0));
            usage.cached_input_tokens = Some(self.state.cached_input_tokens.max(0));
            usage.output_tokens = Some(self.state.output_tokens.max(0));
            usage.total_tokens = self.state.total_tokens.map(|value| value.max(0));
            usage.reasoning_output_tokens = Some(self.state.reasoning_output_tokens.max(0));
            if !self.state.output_text.trim().is_empty() {
                usage.output_text = Some(self.state.output_text.clone());
            }
        }
        let mut out = String::new();
        self.ensure_message_start(&mut out);
        self.close_text_block(&mut out);
        append_sse_event(
            &mut out,
            "message_delta",
            &json!({
                "type": "message_delta",
                "delta": {
                    "stop_reason": self.state.stop_reason.unwrap_or("end_turn"),
                    "stop_sequence": Value::Null
                },
                "usage": {
                    "output_tokens": self.state.output_tokens.max(0)
                }
            }),
        );
        append_sse_event(&mut out, "message_stop", &json!({ "type": "message_stop" }));
        out.into_bytes()
    }
}

impl Read for AnthropicSseReader {
    fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
        loop {
            let read = self.out_cursor.read(buf)?;
            if read > 0 {
                return Ok(read);
            }
            if self.state.finished {
                return Ok(0);
            }
            let next = self.next_chunk()?;
            self.out_cursor = Cursor::new(next);
        }
    }
}

fn append_sse_event(buffer: &mut String, event_name: &str, payload: &Value) {
    let data = serde_json::to_string(payload).unwrap_or_else(|_| "{}".to_string());
    buffer.push_str("event: ");
    buffer.push_str(event_name);
    buffer.push('\n');
    buffer.push_str("data: ");
    buffer.push_str(&data);
    buffer.push_str("\n\n");
}

fn extract_function_call_input(item_obj: &Map<String, Value>) -> Option<Value> {
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
            if trimmed.is_empty() {
                continue;
            }
            if let Ok(parsed) = serde_json::from_str::<Value>(trimmed) {
                return Some(parsed);
            }
            return Some(Value::String(trimmed.to_string()));
        }
        return Some(value.clone());
    }
    None
}

fn tool_input_partial_json(value: Value) -> Option<String> {
    let serialized = serde_json::to_string(&value).ok()?;
    let trimmed = serialized.trim();
    if trimmed.is_empty() || trimmed == "{}" {
        return None;
    }
    Some(trimmed.to_string())
}

#[cfg(test)]
#[path = "tests/http_bridge_tests.rs"]
mod tests;

