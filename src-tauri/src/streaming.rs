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
pub async fn stream_chat(
    app: AppHandle,
    stream_id: u64,
    messages: Vec<ConversationTurn>,
    system_prompt: String,
    provider: String,
    endpoint: String,
    model: String,
    temperature: f64,
    max_tokens: u32,
    images: Vec<String>,
    thinking_enabled: bool,
    thinking_budget: u32,
) -> Result<(), String> {
    let cancel_flag = register_stream(stream_id);

    let api_key = crate::commands::get_provider_key(&provider);

    // HTTPS enforcement: reject insecure endpoints for remote connections.
    // We parse the URL properly instead of using string prefix matching, which
    // would incorrectly accept hosts like `http://localhost.evil.com`.
    if let Err(e) = validate_endpoint_security(&endpoint) {
        unregister_stream(stream_id);
        return Err(e);
    }

    let result = match provider.as_str() {
        "anthropic" => {
            stream_anthropic(
                &app, stream_id, &cancel_flag, &messages, &system_prompt, &endpoint, &api_key,
                &model, temperature, max_tokens, &images, thinking_enabled, thinking_budget,
            )
            .await
        }
        // google, openai, inception, openrouter, custom -> all OpenAI-compatible
        _ => {
            stream_openai_compatible(
                &app, stream_id, &cancel_flag, &messages, &system_prompt, &endpoint, &api_key,
                &model, temperature, max_tokens, &images, thinking_enabled,
            )
            .await
        }
    };

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

#[tauri::command]
pub fn cancel_stream(stream_id: u64) {
    if let Some(flag) = STREAM_REGISTRY.lock().unwrap().get(&stream_id) {
        flag.store(true, Ordering::SeqCst);
    }
}

// Streams a chat through the Hat proxy Worker using the user's Firebase ID
// token for auth. The Worker converts the Hat-format body into a Gemini call,
// streams the response back in OpenAI-compatible SSE format, and debits
// Firestore credits after the stream ends (we observe the balance change via
// the creditsStore's Firestore listener, no extra round-trip needed).
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
    id_token: String,
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
        &id_token,
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

fn validate_endpoint_security(endpoint: &str) -> Result<(), String> {
    let parsed = reqwest::Url::parse(endpoint)
        .map_err(|e| format!("Endpoint inválido: {}", e))?;
    let scheme = parsed.scheme();
    if scheme == "https" {
        return Ok(());
    }
    if scheme == "http" {
        let host = parsed.host_str().unwrap_or("");
        let is_local = matches!(host, "localhost" | "127.0.0.1" | "::1" | "[::1]");
        if is_local {
            return Ok(());
        }
    }
    Err("Endpoint inseguro. Use HTTPS para conexões remotas.".to_string())
}

// Drain all complete lines from a binary buffer, invoking `f` on each line as
// a borrowed &str. Bytes for an incomplete trailing line stay in the buffer.
// Using a byte buffer (instead of String::from_utf8_lossy per chunk) prevents
// corruption when a multi-byte UTF-8 character is split across TCP chunks.
fn drain_lines(buffer: &mut Vec<u8>, mut f: impl FnMut(&str)) {
    while let Some(pos) = buffer.iter().position(|b| *b == b'\n') {
        // line_with_nl includes the newline; we strip it when converting.
        let mut line_with_nl: Vec<u8> = buffer.drain(..=pos).collect();
        line_with_nl.pop(); // drop the '\n'
        if line_with_nl.last() == Some(&b'\r') {
            line_with_nl.pop();
        }
        if let Ok(s) = std::str::from_utf8(&line_with_nl) {
            f(s.trim());
        }
        // Invalid UTF-8 at this point would mean the server sent non-UTF-8 data,
        // which shouldn't happen for JSON; silently skip rather than corrupt.
    }
}

// ----- OpenAI-compatible streaming -----

async fn stream_openai_compatible(
    app: &AppHandle,
    stream_id: u64,
    cancel_flag: &Arc<AtomicBool>,
    messages: &[ConversationTurn],
    system_prompt: &str,
    endpoint: &str,
    api_key: &str,
    model: &str,
    temperature: f64,
    max_tokens: u32,
    images: &[String],
    _thinking_enabled: bool,
) -> Result<(), String> {
    let url = format!("{}/chat/completions", endpoint.trim_end_matches('/'));

    let mut api_messages = Vec::new();

    // System message
    if !system_prompt.is_empty() {
        api_messages.push(serde_json::json!({
            "role": "system",
            "content": system_prompt
        }));
    }

    // Build message list
    for (i, turn) in messages.iter().enumerate() {
        let turn_images = turn.images.as_deref().unwrap_or(&[]);
        let is_last = i == messages.len() - 1;
        let combined_images: Vec<&str> = if is_last {
            // Combine turn images with top-level images for the last message
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

    let body = serde_json::json!({
        "model": model,
        "messages": api_messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": true
    });

    let client = reqwest::Client::new();
    let mut headers = HeaderMap::new();
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
    if !api_key.is_empty() {
        headers.insert(
            AUTHORIZATION,
            HeaderValue::from_str(&format!("Bearer {}", api_key))
                .map_err(|e| format!("Header invalido: {}", e))?,
        );
    }

    let response = client
        .post(&url)
        .headers(headers)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Erro de conexao: {}", e))?;

    let status = response.status();
    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(map_http_error(status.as_u16(), &error_text));
    }

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
                        // Parse <thoughts> tags (Gemini thinking) similar to Ollama <think> parsing
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
                                    remaining = remaining[end_pos + "</thoughts>".len()..].to_string();
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

                    // Check for reasoning_content (OpenAI reasoning models)
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

                    // Check for usage in the final chunk
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

    // If stream ended without [DONE], send finish
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

// ----- Anthropic streaming -----

async fn stream_anthropic(
    app: &AppHandle,
    stream_id: u64,
    cancel_flag: &Arc<AtomicBool>,
    messages: &[ConversationTurn],
    system_prompt: &str,
    endpoint: &str,
    api_key: &str,
    model: &str,
    temperature: f64,
    max_tokens: u32,
    images: &[String],
    thinking_enabled: bool,
    thinking_budget: u32,
) -> Result<(), String> {
    let url = format!("{}/messages", endpoint.trim_end_matches('/'));

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
            let mut content_blocks = Vec::new();
            for img in &combined_images {
                // Strip data URI prefix if present
                let base64_data = if let Some(stripped) = img.strip_prefix("data:image/png;base64,") {
                    stripped.to_string()
                } else if let Some(stripped) = img.strip_prefix("data:image/jpeg;base64,") {
                    stripped.to_string()
                } else if img.starts_with("data:") {
                    // Generic data URI
                    img.split(',').nth(1).unwrap_or(img).to_string()
                } else {
                    img.to_string()
                };
                content_blocks.push(serde_json::json!({
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": "image/png",
                        "data": base64_data
                    }
                }));
            }
            content_blocks.push(serde_json::json!({
                "type": "text",
                "text": turn.text_content
            }));
            api_messages.push(serde_json::json!({
                "role": turn.role,
                "content": content_blocks
            }));
        } else {
            api_messages.push(serde_json::json!({
                "role": turn.role,
                "content": turn.text_content
            }));
        }
    }

    let effective_temperature = if thinking_enabled { 1.0 } else { temperature };
    let effective_max_tokens = if thinking_enabled && max_tokens < thinking_budget + 1 {
        thinking_budget + 1
    } else {
        max_tokens
    };

    let mut body = serde_json::json!({
        "model": model,
        "messages": api_messages,
        "max_tokens": effective_max_tokens,
        "temperature": effective_temperature,
        "stream": true
    });

    if thinking_enabled {
        body["thinking"] = serde_json::json!({
            "type": "enabled",
            "budget_tokens": thinking_budget
        });
    }

    if !system_prompt.is_empty() {
        body["system"] = serde_json::json!(system_prompt);
    }

    let client = reqwest::Client::new();
    let response = client
        .post(&url)
        .header(CONTENT_TYPE, "application/json")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Erro de conexao: {}", e))?;

    let status = response.status();
    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(map_http_error(status.as_u16(), &error_text));
    }

    let mut stream = response.bytes_stream();
    let mut buffer: Vec<u8> = Vec::new();
    let mut input_tokens: Option<u32> = None;
    let mut output_tokens: Option<u32> = None;
    let mut finished = false;
    let mut current_event_name = String::new();
    let mut current_block_type = "text".to_string();

    while let Some(chunk) = stream.next().await {
        if cancel_flag.load(Ordering::SeqCst) {
            let _ = app.emit(
                "chat-stream",
                StreamChunkPayload {
                    stream_id,
                    text: String::new(),
                    is_finished: true,
                    input_tokens,
                    output_tokens,
                    content_type: "text".to_string(),
                },
            );
            return Ok(());
        }

        let chunk = chunk.map_err(|e| format!("Erro no stream: {}", e))?;
        buffer.extend_from_slice(&chunk);

        drain_lines(&mut buffer, |line| {
            if finished || line.is_empty() {
                return;
            }

            // Capture event: lines instead of skipping them
            if let Some(event_name) = line.strip_prefix("event:") {
                current_event_name = event_name.trim().to_string();
                return;
            }

            if let Some(data) = line.strip_prefix("data: ") {
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(data) {
                    let event_type = json["type"].as_str().unwrap_or("");

                    match event_type {
                        "content_block_start" => {
                            let block_type = json["content_block"]["type"]
                                .as_str()
                                .unwrap_or("text");
                            current_block_type = block_type.to_string();
                        }
                        "content_block_delta" => {
                            if current_block_type == "thinking" {
                                let thinking_text = json["delta"]["thinking"]
                                    .as_str()
                                    .unwrap_or("");
                                if !thinking_text.is_empty() {
                                    let _ = app.emit(
                                        "chat-stream",
                                        StreamChunkPayload {
                                            stream_id,
                                            text: thinking_text.to_string(),
                                            is_finished: false,
                                            input_tokens: None,
                                            output_tokens: None,
                                            content_type: "thinking".to_string(),
                                        },
                                    );
                                }
                            } else {
                                let text = json["delta"]["text"].as_str().unwrap_or("");
                                if !text.is_empty() {
                                    let _ = app.emit(
                                        "chat-stream",
                                        StreamChunkPayload {
                                            stream_id,
                                            text: text.to_string(),
                                            is_finished: false,
                                            input_tokens: None,
                                            output_tokens: None,
                                            content_type: "text".to_string(),
                                        },
                                    );
                                }
                            }
                        }
                        "content_block_stop" => {
                            current_block_type = "text".to_string();
                        }
                        "message_start" => {
                            if let Some(usage) = json["message"].get("usage") {
                                input_tokens =
                                    usage["input_tokens"].as_u64().map(|v| v as u32);
                            }
                        }
                        "message_delta" => {
                            if let Some(usage) = json.get("usage") {
                                output_tokens =
                                    usage["output_tokens"].as_u64().map(|v| v as u32);
                            }
                        }
                        "message_stop" => {
                            let _ = app.emit(
                                "chat-stream",
                                StreamChunkPayload {
                                    stream_id,
                                    text: String::new(),
                                    is_finished: true,
                                    input_tokens,
                                    output_tokens,
                                    content_type: "text".to_string(),
                                },
                            );
                            finished = true;
                        }
                        _ => {}
                    }
                }
            }
            // Suppress unused variable warning
            let _ = &current_event_name;
        });

        if finished {
            return Ok(());
        }
    }

    // Stream ended without message_stop
    let _ = app.emit(
        "chat-stream",
        StreamChunkPayload {
            stream_id,
            text: String::new(),
            is_finished: true,
            input_tokens,
            output_tokens,
            content_type: "text".to_string(),
        },
    );

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
    id_token: &str,
) -> Result<(), String> {
    // Same OpenAI-style content array when images are present on the last turn;
    // the Worker passes this through to the Gemini OpenAI-compat endpoint.
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

    let body = serde_json::json!({
        "mode": mode,
        "messages": api_messages,
        "systemPrompt": system_prompt,
        "temperature": temperature,
        "maxTokens": max_tokens,
    });

    let client = reqwest::Client::new();
    let response = client
        .post(HAT_PROXY_URL)
        .header(CONTENT_TYPE, "application/json")
        .header(
            AUTHORIZATION,
            HeaderValue::from_str(&format!("Bearer {}", id_token))
                .map_err(|e| format!("Token inválido: {}", e))?,
        )
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Erro ao conectar ao Hat: {}", e))?;

    let status = response.status();
    if !status.is_success() {
        let body_text = response.text().await.unwrap_or_default();
        return Err(map_hat_proxy_error(status.as_u16(), &body_text));
    }

    // Worker pipes through Gemini's OpenAI-compat SSE without modification, so
    // the same parser we use for direct Gemini/OpenAI calls works verbatim.
    consume_openai_sse(app, stream_id, cancel_flag, response).await
}

// Translates Worker-level HTTP errors into user-friendly PT-BR messages.
// The Worker returns 402 when the balance is too low (bounce before starting
// the stream), 401 on bad/missing JWT, 500 on Gemini upstream failures.
fn map_hat_proxy_error(status: u16, body: &str) -> String {
    // Try to pluck {"error": "..."} out of the body for more detail.
    let detail = serde_json::from_str::<serde_json::Value>(body)
        .ok()
        .and_then(|v| v["error"].as_str().map(|s| s.to_string()))
        .unwrap_or_default();

    match status {
        401 => "Sessão expirada. Faça login de novo para continuar.".to_string(),
        402 => "Créditos insuficientes. Recarregue via PIX na aba Conta.".to_string(),
        429 => "Muitas requisições em pouco tempo. Aguarde alguns segundos.".to_string(),
        500..=599 => format!("Erro no Hat ({}): {}", status, detail),
        _ => format!("Erro do Hat ({}): {}", status, detail),
    }
}

// ----- SSE consumption (shared between direct BYOK and Hat proxy paths) -----

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
                                    remaining = remaining[end_pos + "</thoughts>".len()..].to_string();
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

// ----- Fetch models -----

#[tauri::command]
pub async fn fetch_models(
    provider: String,
    endpoint: String,
) -> Result<Vec<String>, String> {
    let api_key = crate::commands::get_provider_key(&provider);
    let url = match provider.as_str() {
        "anthropic" => {
            // Anthropic doesn't have a public models endpoint; return hardcoded list
            return Ok(vec![
                "claude-sonnet-4-6".to_string(),
                "claude-opus-4-6".to_string(),
                "claude-haiku-4-5-20251001".to_string(),
                "claude-3-5-sonnet-20241022".to_string(),
                "claude-3-5-haiku-20241022".to_string(),
            ]);
        }
        _ => format!("{}/models", endpoint.trim_end_matches('/')),
    };

    let client = reqwest::Client::new();
    let mut req = client.get(&url);

    if !api_key.is_empty() {
        req = req.header("Authorization", format!("Bearer {}", api_key));
    }

    let response = req
        .send()
        .await
        .map_err(|e| format!("Erro ao buscar modelos: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Erro ao buscar modelos ({})", response.status().as_u16()));
    }

    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Erro ao parsear resposta: {}", e))?;

    // Both OpenAI-compatible and OpenRouter return { "data": [{ "id": "..." }] }
    let models = json["data"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|m| m["id"].as_str().map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default();

    Ok(models)
}

// ----- Error mapping -----

fn map_http_error(status: u16, _body: &str) -> String {
    match status {
        401 => "Chave de API inválida ou expirada. Verifique suas configurações.".to_string(),
        403 => "Acesso negado. Verifique as permissões da sua chave de API.".to_string(),
        404 => "Modelo não encontrado. Verifique o nome do modelo nas configurações.".to_string(),
        429 => "Limite de requisições atingido. Aguarde um momento e tente novamente.".to_string(),
        500 => "Erro interno do servidor do provedor. Tente novamente.".to_string(),
        502 | 503 => "Serviço temporariamente indisponível. Tente novamente em instantes.".to_string(),
        _ => format!("Erro do servidor ({}).", status),
    }
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
        let part1: Vec<u8> = vec![b'i', b'm', b'p', b'l', b'e', b'm', b'e', b'n', b't', b'a', b'\xC3'];
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
    fn validate_endpoint_rejects_localhost_prefix_attack() {
        assert!(validate_endpoint_security("http://localhost.evil.com").is_err());
        assert!(validate_endpoint_security("http://localhostfoo.example").is_err());
        assert!(validate_endpoint_security("http://127.0.0.1.evil.com").is_err());
    }

    #[test]
    fn validate_endpoint_accepts_real_local_and_https() {
        assert!(validate_endpoint_security("http://localhost:11434").is_ok());
        assert!(validate_endpoint_security("http://127.0.0.1:8080/api").is_ok());
        assert!(validate_endpoint_security("https://api.openai.com/v1").is_ok());
    }

    #[test]
    fn validate_endpoint_rejects_plain_http_remote() {
        assert!(validate_endpoint_security("http://api.example.com").is_err());
    }
}
