use futures::StreamExt;
use once_cell::sync::Lazy;
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};

// Registry of active streams: maps caller-supplied stream_id to its cancel flag.
// Each stream gets its own Arc<AtomicBool>, so concurrent streams never share
// cancellation state and cancelling one never affects another.
static STREAM_REGISTRY: Lazy<Mutex<HashMap<u64, Arc<AtomicBool>>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

fn register_stream(stream_id: u64) -> Arc<AtomicBool> {
    let flag = Arc::new(AtomicBool::new(false));
    STREAM_REGISTRY
        .lock()
        .unwrap()
        .insert(stream_id, flag.clone());
    flag
}

fn unregister_stream(stream_id: u64) {
    STREAM_REGISTRY.lock().unwrap().remove(&stream_id);
}

// ----- Data structures -----

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ConversationTurn {
    pub role: String,
    #[serde(rename = "textContent")]
    pub text_content: String,
    pub images: Option<Vec<String>>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct StreamChunkPayload {
    pub stream_id: u64,
    pub text: String,
    pub is_finished: bool,
    pub input_tokens: Option<u32>,
    pub output_tokens: Option<u32>,
    pub content_type: String, // "text" | "thinking"
}

// ----- Commands -----

#[tauri::command]
pub fn cancel_stream(stream_id: u64) {
    if let Some(flag) = STREAM_REGISTRY.lock().unwrap().get(&stream_id) {
        flag.store(true, Ordering::SeqCst);
    }
}

// Only LLM path post-BYOK removal (2026-04-16). The Hat proxy Worker handles
// auth, credits, and the conversation with Gemini; clients here just forward
// the user's Firebase ID token + the selected mode.
#[tauri::command]
pub async fn stream_chat_hat(
    app: AppHandle,
    stream_id: u64,
    messages: Vec<ConversationTurn>,
    system_prompt: String,
    mode: String,
    temperature: f64,
    max_tokens: u32,
    images: Vec<String>,
    room_id: Option<String>,
    room_share: bool,
    source_message_id: Option<String>,
    id_token: String,
    idempotency_key: String,
) -> Result<(), String> {
    let cancel_flag = register_stream(stream_id);

    let result = stream_chat_hat_impl(
        &app,
        stream_id,
        &cancel_flag,
        &messages,
        &system_prompt,
        &mode,
        temperature,
        max_tokens,
        &images,
        room_id.as_deref(),
        room_share,
        source_message_id.as_deref(),
        &id_token,
        &idempotency_key,
    )
    .await;

    unregister_stream(stream_id);

    if let Err(e) = result {
        let _ = app.emit(
            "chat-stream",
            StreamChunkPayload {
                stream_id,
                text: e.clone(),
                is_finished: true,
                input_tokens: None,
                output_tokens: None,
                content_type: "text".to_string(),
            },
        );
        return Err(e);
    }

    Ok(())
}

// ----- Hat proxy streaming -----

const HAT_PROXY_URL: &str = "https://hat-proxy.joao02simi.workers.dev/v1/chat";

async fn stream_chat_hat_impl(
    app: &AppHandle,
    stream_id: u64,
    cancel_flag: &Arc<AtomicBool>,
    messages: &[ConversationTurn],
    system_prompt: &str,
    mode: &str,
    temperature: f64,
    max_tokens: u32,
    images: &[String],
    room_id: Option<&str>,
    room_share: bool,
    source_message_id: Option<&str>,
    id_token: &str,
    idempotency_key: &str,
) -> Result<(), String> {
    // OpenAI-style content array when images are present on the last turn;
    // the Worker translates this into Gemini's native inlineData format.
    let mut api_messages = Vec::new();
    for (i, turn) in messages.iter().enumerate() {
        let turn_images = turn.images.as_deref().unwrap_or(&[]);
        let is_last = i == messages.len() - 1;
        let combined_images: Vec<&str> = if is_last {
            turn_images
                .iter()
                .chain(images.iter())
                .map(|s| s.as_str())
                .collect()
        } else {
            turn_images.iter().map(|s| s.as_str()).collect()
        };

        if !combined_images.is_empty() {
            let mut content_parts = Vec::new();
            for img in &combined_images {
                let image_url = if img.starts_with("data:") {
                    img.to_string()
                } else {
                    format!("data:image/png;base64,{}", img)
                };
                content_parts.push(serde_json::json!({
                    "type": "image_url",
                    "image_url": { "url": image_url }
                }));
            }
            content_parts.push(serde_json::json!({
                "type": "text",
                "text": turn.text_content
            }));
            api_messages.push(serde_json::json!({
                "role": turn.role,
                "content": content_parts
            }));
        } else {
            api_messages.push(serde_json::json!({
                "role": turn.role,
                "content": turn.text_content
            }));
        }
    }

    let mut body = serde_json::json!({
        "mode": mode,
        "messages": api_messages,
        "systemPrompt": system_prompt,
        "temperature": temperature,
        "maxTokens": max_tokens,
    });
    if room_share {
        body["roomShare"] = serde_json::json!(true);
    }
    if let Some(room_id) = room_id {
        body["roomId"] = serde_json::json!(room_id);
    }
    if let Some(source_message_id) = source_message_id {
        body["sourceMessageId"] = serde_json::json!(source_message_id);
    }

    let client = reqwest::Client::new();
    let mut headers = HeaderMap::new();
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
    headers.insert(
        AUTHORIZATION,
        HeaderValue::from_str(&format!("Bearer {}", id_token))
            .map_err(|e| format!("Token inválido: {}", e))?,
    );
    // Idempotency-Key: UUID gerado pelo cliente a cada submit. O Worker usa
    // pra impedir double-debit em retries automáticos (reqwest, TCP RST, etc).
    // O valor vem do TS via crypto.randomUUID() — um por submit, mesmo em retry.
    if !idempotency_key.is_empty() {
        if let Ok(v) = HeaderValue::from_str(idempotency_key) {
            headers.insert("Idempotency-Key", v);
        }
    }

    let response = client
        .post(HAT_PROXY_URL)
        .headers(headers)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Erro ao conectar ao Hat: {}", e))?;

    let status = response.status();
    if !status.is_success() {
        let body_text = response.text().await.unwrap_or_default();
        return Err(map_hat_proxy_error(status.as_u16(), &body_text));
    }

    // Worker emits OpenAI-compatible SSE (translated from Gemini's native
    // format server-side), so the parser below just looks for the usual
    // `choices[0].delta.content` / `usage` fields.
    consume_openai_sse(app, stream_id, cancel_flag, response).await
}

// Traduz erros HTTP do Worker em CÓDIGOS (não strings PT-BR) — o cliente
// resolve via i18n para a língua corrente. Formato: `error:<code>[:detail]`.
// O TS identifica pelo prefixo `error:` e faz lookup em errors.json.
fn map_hat_proxy_error(status: u16, body: &str) -> String {
    let detail = serde_json::from_str::<serde_json::Value>(body)
        .ok()
        .and_then(|v| v["error"].as_str().map(|s| s.to_string()))
        .unwrap_or_default();
    let detail_lower = detail.to_lowercase();

    if matches!(status, 400 | 404)
        && (detail_lower.contains("gemini")
            || detail_lower.contains("model")
            || detail_lower.contains("deprecated")
            || detail_lower.contains("not found")
            || detail_lower.contains("unavailable")
            || detail_lower.contains("invalid argument"))
    {
        return format!("error:serverError:{}:upstream-model-unavailable", status);
    }

    match status {
        401 => "error:sessionExpired".to_string(),
        402 => "error:insufficientCredits".to_string(),
        429 => "error:rateLimited".to_string(),
        500..=599 => format!("error:serverError:{}:{}", status, detail),
        _ => format!("error:unknownError:{}:{}", status, detail),
    }
}

// ----- SSE parsing helpers -----

// Drain all complete lines from a binary buffer, invoking `f` on each line as
// a borrowed &str. Bytes for an incomplete trailing line stay in the buffer.
// Using a byte buffer (instead of String::from_utf8_lossy per chunk) prevents
// corruption when a multi-byte UTF-8 character is split across TCP chunks.
fn drain_lines(buffer: &mut Vec<u8>, mut f: impl FnMut(&str)) {
    while let Some(pos) = buffer.iter().position(|b| *b == b'\n') {
        let mut line_with_nl: Vec<u8> = buffer.drain(..=pos).collect();
        line_with_nl.pop(); // drop the '\n'
        if line_with_nl.last() == Some(&b'\r') {
            line_with_nl.pop();
        }
        if let Ok(s) = std::str::from_utf8(&line_with_nl) {
            f(s.trim());
        }
    }
}

async fn consume_openai_sse(
    app: &AppHandle,
    stream_id: u64,
    cancel_flag: &Arc<AtomicBool>,
    response: reqwest::Response,
) -> Result<(), String> {
    let mut stream = response.bytes_stream();
    let mut buffer: Vec<u8> = Vec::new();
    let mut finished = false;
    let mut in_thoughts_block: bool = false;

    while let Some(chunk) = stream.next().await {
        if cancel_flag.load(Ordering::SeqCst) {
            let _ = app.emit(
                "chat-stream",
                StreamChunkPayload {
                    stream_id,
                    text: String::new(),
                    is_finished: true,
                    input_tokens: None,
                    output_tokens: None,
                    content_type: "text".to_string(),
                },
            );
            return Ok(());
        }

        let chunk = chunk.map_err(|e| format!("Erro no stream: {}", e))?;
        buffer.extend_from_slice(&chunk);

        drain_lines(&mut buffer, |line| {
            if finished || line.is_empty() || line.starts_with(':') {
                return;
            }

            if let Some(data) = line.strip_prefix("data: ") {
                if data.trim() == "[DONE]" {
                    let _ = app.emit(
                        "chat-stream",
                        StreamChunkPayload {
                            stream_id,
                            text: String::new(),
                            is_finished: true,
                            input_tokens: None,
                            output_tokens: None,
                            content_type: "text".to_string(),
                        },
                    );
                    finished = true;
                    return;
                }

                if let Ok(json) = serde_json::from_str::<serde_json::Value>(data) {
                    let content = json["choices"][0]["delta"]["content"]
                        .as_str()
                        .unwrap_or("");

                    if !content.is_empty() {
                        let mut remaining = content.to_string();
                        while !remaining.is_empty() {
                            if in_thoughts_block {
                                if let Some(end_pos) = remaining.find("</thoughts>") {
                                    let before = &remaining[..end_pos];
                                    if !before.is_empty() {
                                        let _ = app.emit(
                                            "chat-stream",
                                            StreamChunkPayload {
                                                stream_id,
                                                text: before.to_string(),
                                                is_finished: false,
                                                input_tokens: None,
                                                output_tokens: None,
                                                content_type: "thinking".to_string(),
                                            },
                                        );
                                    }
                                    in_thoughts_block = false;
                                    remaining =
                                        remaining[end_pos + "</thoughts>".len()..].to_string();
                                } else {
                                    let _ = app.emit(
                                        "chat-stream",
                                        StreamChunkPayload {
                                            stream_id,
                                            text: remaining.to_string(),
                                            is_finished: false,
                                            input_tokens: None,
                                            output_tokens: None,
                                            content_type: "thinking".to_string(),
                                        },
                                    );
                                    remaining.clear();
                                }
                            } else if let Some(start_pos) = remaining.find("<thoughts>") {
                                let before = &remaining[..start_pos];
                                if !before.is_empty() {
                                    let _ = app.emit(
                                        "chat-stream",
                                        StreamChunkPayload {
                                            stream_id,
                                            text: before.to_string(),
                                            is_finished: false,
                                            input_tokens: None,
                                            output_tokens: None,
                                            content_type: "text".to_string(),
                                        },
                                    );
                                }
                                in_thoughts_block = true;
                                remaining = remaining[start_pos + "<thoughts>".len()..].to_string();
                            } else {
                                let _ = app.emit(
                                    "chat-stream",
                                    StreamChunkPayload {
                                        stream_id,
                                        text: remaining.to_string(),
                                        is_finished: false,
                                        input_tokens: None,
                                        output_tokens: None,
                                        content_type: "text".to_string(),
                                    },
                                );
                                remaining.clear();
                            }
                        }
                    }

                    let reasoning = json["choices"][0]["delta"]["reasoning_content"]
                        .as_str()
                        .unwrap_or("");
                    if !reasoning.is_empty() {
                        let _ = app.emit(
                            "chat-stream",
                            StreamChunkPayload {
                                stream_id,
                                text: reasoning.to_string(),
                                is_finished: false,
                                input_tokens: None,
                                output_tokens: None,
                                content_type: "thinking".to_string(),
                            },
                        );
                    }

                    if let Some(usage) = json.get("usage") {
                        let input_tokens = usage["prompt_tokens"].as_u64().map(|v| v as u32);
                        let output_tokens = usage["completion_tokens"].as_u64().map(|v| v as u32);
                        if input_tokens.is_some() || output_tokens.is_some() {
                            let _ = app.emit(
                                "chat-stream",
                                StreamChunkPayload {
                                    stream_id,
                                    text: String::new(),
                                    is_finished: false,
                                    input_tokens,
                                    output_tokens,
                                    content_type: "text".to_string(),
                                },
                            );
                        }
                    }
                }
            }
        });

        if finished {
            return Ok(());
        }
    }

    let _ = app.emit(
        "chat-stream",
        StreamChunkPayload {
            stream_id,
            text: String::new(),
            is_finished: true,
            input_tokens: None,
            output_tokens: None,
            content_type: "text".to_string(),
        },
    );

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn drain_lines_basic() {
        let mut buf: Vec<u8> = b"alpha\nbeta\ngam".to_vec();
        let mut out = Vec::new();
        drain_lines(&mut buf, |s| out.push(s.to_string()));
        assert_eq!(out, vec!["alpha".to_string(), "beta".to_string()]);
        assert_eq!(buf, b"gam".to_vec());
    }

    #[test]
    fn drain_lines_preserves_utf8_across_chunks() {
        // Simulate "implementação" split mid-byte across two pushes.
        // "ç" is 0xC3 0xA7; we split it.
        let part1: Vec<u8> = vec![
            b'i', b'm', b'p', b'l', b'e', b'm', b'e', b'n', b't', b'a', b'\xC3',
        ];
        let part2: Vec<u8> = vec![b'\xA7', b'\xC3', b'\xA3', b'o', b'\n'];
        let mut buf: Vec<u8> = Vec::new();
        buf.extend_from_slice(&part1);
        let mut out: Vec<String> = Vec::new();
        drain_lines(&mut buf, |s| out.push(s.to_string()));
        assert!(out.is_empty(), "no complete line yet");
        buf.extend_from_slice(&part2);
        drain_lines(&mut buf, |s| out.push(s.to_string()));
        assert_eq!(out, vec!["implementação".to_string()]);
    }

    #[test]
    fn drain_lines_strips_crlf() {
        let mut buf: Vec<u8> = b"data: hello\r\n".to_vec();
        let mut out = Vec::new();
        drain_lines(&mut buf, |s| out.push(s.to_string()));
        assert_eq!(out, vec!["data: hello".to_string()]);
    }

    #[test]
    fn map_hat_proxy_model_deprecation_to_provider_error() {
        let old_model = format!("{}{}", "gemini-3.1-flash-lite", "-preview");
        let body = format!(
            r#"{{"error":"{} is deprecated. Use gemini-3.1-flash-lite."}}"#,
            old_model
        );
        assert_eq!(
            map_hat_proxy_error(400, &body),
            "error:serverError:400:upstream-model-unavailable".to_string()
        );
    }

    #[test]
    fn map_hat_proxy_model_not_found_to_provider_error() {
        let old_model = format!("{}{}", "gemini-3.1-flash-lite", "-preview");
        let body = format!(r#"{{"error":"models/{} is not found"}}"#, old_model);
        assert_eq!(
            map_hat_proxy_error(404, &body),
            "error:serverError:404:upstream-model-unavailable".to_string()
        );
    }

    #[test]
    fn map_hat_proxy_plain_bad_request_remains_unknown() {
        let body = r#"{"error":"bad request"}"#;
        assert_eq!(
            map_hat_proxy_error(400, body),
            "error:unknownError:400:bad request".to_string()
        );
    }
}
