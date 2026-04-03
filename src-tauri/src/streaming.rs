use futures::StreamExt;
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Emitter};

static CANCEL_STREAM: AtomicBool = AtomicBool::new(false);

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
    pub text: String,
    pub is_finished: bool,
    pub input_tokens: Option<u32>,
    pub output_tokens: Option<u32>,
}

// ----- Commands -----

#[tauri::command]
pub async fn stream_chat(
    app: AppHandle,
    messages: Vec<ConversationTurn>,
    system_prompt: String,
    provider: String,
    endpoint: String,
    model: String,
    temperature: f64,
    max_tokens: u32,
    images: Vec<String>,
) -> Result<(), String> {
    CANCEL_STREAM.store(false, Ordering::SeqCst);

    let api_key = crate::commands::get_provider_key(&provider);

    // HTTPS enforcement: reject insecure endpoints for remote connections
    if !endpoint.starts_with("https://") && !endpoint.starts_with("http://localhost") && !endpoint.starts_with("http://127.0.0.1") {
        return Err("Endpoint inseguro. Use HTTPS para conexões remotas.".to_string());
    }

    let result = match provider.as_str() {
        "anthropic" => {
            stream_anthropic(
                &app, &messages, &system_prompt, &endpoint, &api_key, &model,
                temperature, max_tokens, &images,
            )
            .await
        }
        "ollama" => {
            stream_ollama(
                &app, &messages, &system_prompt, &model, temperature, &images,
            )
            .await
        }
        // openai, google, inception, openrouter, custom -> all OpenAI-compatible
        _ => {
            stream_openai_compatible(
                &app, &messages, &system_prompt, &endpoint, &api_key, &model,
                temperature, max_tokens, &images,
            )
            .await
        }
    };

    if let Err(e) = result {
        let _ = app.emit(
            "chat-stream",
            StreamChunkPayload {
                text: e.clone(),
                is_finished: true,
                input_tokens: None,
                output_tokens: None,
            },
        );
        return Err(e);
    }

    Ok(())
}

#[tauri::command]
pub fn cancel_stream() {
    CANCEL_STREAM.store(true, Ordering::SeqCst);
}

// ----- OpenAI-compatible streaming -----

async fn stream_openai_compatible(
    app: &AppHandle,
    messages: &[ConversationTurn],
    system_prompt: &str,
    endpoint: &str,
    api_key: &str,
    model: &str,
    temperature: f64,
    max_tokens: u32,
    images: &[String],
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
    let mut buffer = String::new();

    while let Some(chunk) = stream.next().await {
        if CANCEL_STREAM.load(Ordering::SeqCst) {
            let _ = app.emit(
                "chat-stream",
                StreamChunkPayload {
                    text: String::new(),
                    is_finished: true,
                    input_tokens: None,
                    output_tokens: None,
                },
            );
            return Ok(());
        }

        let chunk = chunk.map_err(|e| format!("Erro no stream: {}", e))?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        // Process complete lines
        while let Some(newline_pos) = buffer.find('\n') {
            let line = buffer[..newline_pos].trim().to_string();
            buffer = buffer[newline_pos + 1..].to_string();

            if line.is_empty() || line.starts_with(':') {
                continue;
            }

            if let Some(data) = line.strip_prefix("data: ") {
                if data.trim() == "[DONE]" {
                    let _ = app.emit(
                        "chat-stream",
                        StreamChunkPayload {
                            text: String::new(),
                            is_finished: true,
                            input_tokens: None,
                            output_tokens: None,
                        },
                    );
                    return Ok(());
                }

                if let Ok(json) = serde_json::from_str::<serde_json::Value>(data) {
                    let content = json["choices"][0]["delta"]["content"]
                        .as_str()
                        .unwrap_or("");

                    if !content.is_empty() {
                        let _ = app.emit(
                            "chat-stream",
                            StreamChunkPayload {
                                text: content.to_string(),
                                is_finished: false,
                                input_tokens: None,
                                output_tokens: None,
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
                                    text: String::new(),
                                    is_finished: false,
                                    input_tokens,
                                    output_tokens,
                                },
                            );
                        }
                    }
                }
            }
        }
    }

    // If stream ended without [DONE], send finish
    let _ = app.emit(
        "chat-stream",
        StreamChunkPayload {
            text: String::new(),
            is_finished: true,
            input_tokens: None,
            output_tokens: None,
        },
    );

    Ok(())
}

// ----- Anthropic streaming -----

async fn stream_anthropic(
    app: &AppHandle,
    messages: &[ConversationTurn],
    system_prompt: &str,
    endpoint: &str,
    api_key: &str,
    model: &str,
    temperature: f64,
    max_tokens: u32,
    images: &[String],
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

    let mut body = serde_json::json!({
        "model": model,
        "messages": api_messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "stream": true
    });

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
    let mut buffer = String::new();
    let mut input_tokens: Option<u32> = None;
    let mut output_tokens: Option<u32> = None;

    while let Some(chunk) = stream.next().await {
        if CANCEL_STREAM.load(Ordering::SeqCst) {
            let _ = app.emit(
                "chat-stream",
                StreamChunkPayload {
                    text: String::new(),
                    is_finished: true,
                    input_tokens,
                    output_tokens,
                },
            );
            return Ok(());
        }

        let chunk = chunk.map_err(|e| format!("Erro no stream: {}", e))?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        while let Some(newline_pos) = buffer.find('\n') {
            let line = buffer[..newline_pos].trim().to_string();
            buffer = buffer[newline_pos + 1..].to_string();

            if line.is_empty() || line.starts_with("event:") {
                continue;
            }

            if let Some(data) = line.strip_prefix("data: ") {
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(data) {
                    let event_type = json["type"].as_str().unwrap_or("");

                    match event_type {
                        "content_block_delta" => {
                            let text = json["delta"]["text"].as_str().unwrap_or("");
                            if !text.is_empty() {
                                let _ = app.emit(
                                    "chat-stream",
                                    StreamChunkPayload {
                                        text: text.to_string(),
                                        is_finished: false,
                                        input_tokens: None,
                                        output_tokens: None,
                                    },
                                );
                            }
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
                                    text: String::new(),
                                    is_finished: true,
                                    input_tokens,
                                    output_tokens,
                                },
                            );
                            return Ok(());
                        }
                        _ => {}
                    }
                }
            }
        }
    }

    // Stream ended without message_stop
    let _ = app.emit(
        "chat-stream",
        StreamChunkPayload {
            text: String::new(),
            is_finished: true,
            input_tokens,
            output_tokens,
        },
    );

    Ok(())
}

// ----- Ollama streaming -----

async fn stream_ollama(
    app: &AppHandle,
    messages: &[ConversationTurn],
    system_prompt: &str,
    model: &str,
    temperature: f64,
    images: &[String],
) -> Result<(), String> {
    let url = "http://localhost:11434/api/chat";

    let mut api_messages = Vec::new();

    if !system_prompt.is_empty() {
        api_messages.push(serde_json::json!({
            "role": "system",
            "content": system_prompt
        }));
    }

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

        let mut msg = serde_json::json!({
            "role": turn.role,
            "content": turn.text_content
        });

        if !combined_images.is_empty() {
            // Ollama expects base64 strings directly (no data URI prefix)
            let clean_images: Vec<String> = combined_images
                .iter()
                .map(|img| {
                    if img.contains(",") {
                        img.split(',').nth(1).unwrap_or(img).to_string()
                    } else {
                        img.to_string()
                    }
                })
                .collect();
            msg["images"] = serde_json::json!(clean_images);
        }

        api_messages.push(msg);
    }

    let body = serde_json::json!({
        "model": model,
        "messages": api_messages,
        "stream": true,
        "options": {
            "temperature": temperature
        }
    });

    let client = reqwest::Client::new();
    let response = client
        .post(url)
        .header(CONTENT_TYPE, "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| {
            format!(
                "Erro ao conectar ao Ollama. Verifique se o Ollama esta rodando: {}",
                e
            )
        })?;

    let status = response.status();
    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(map_http_error(status.as_u16(), &error_text));
    }

    let mut stream = response.bytes_stream();
    let mut buffer = String::new();

    while let Some(chunk) = stream.next().await {
        if CANCEL_STREAM.load(Ordering::SeqCst) {
            let _ = app.emit(
                "chat-stream",
                StreamChunkPayload {
                    text: String::new(),
                    is_finished: true,
                    input_tokens: None,
                    output_tokens: None,
                },
            );
            return Ok(());
        }

        let chunk = chunk.map_err(|e| format!("Erro no stream: {}", e))?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        while let Some(newline_pos) = buffer.find('\n') {
            let line = buffer[..newline_pos].trim().to_string();
            buffer = buffer[newline_pos + 1..].to_string();

            if line.is_empty() {
                continue;
            }

            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&line) {
                let done = json["done"].as_bool().unwrap_or(false);

                if done {
                    let input_tokens = json["prompt_eval_count"].as_u64().map(|v| v as u32);
                    let output_tokens = json["eval_count"].as_u64().map(|v| v as u32);
                    let _ = app.emit(
                        "chat-stream",
                        StreamChunkPayload {
                            text: String::new(),
                            is_finished: true,
                            input_tokens,
                            output_tokens,
                        },
                    );
                    return Ok(());
                }

                let content = json["message"]["content"].as_str().unwrap_or("");
                if !content.is_empty() {
                    let _ = app.emit(
                        "chat-stream",
                        StreamChunkPayload {
                            text: content.to_string(),
                            is_finished: false,
                            input_tokens: None,
                            output_tokens: None,
                        },
                    );
                }
            }
        }
    }

    // Stream ended
    let _ = app.emit(
        "chat-stream",
        StreamChunkPayload {
            text: String::new(),
            is_finished: true,
            input_tokens: None,
            output_tokens: None,
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
        "ollama" => "http://localhost:11434/api/tags".to_string(),
        _ => format!("{}/models", endpoint.trim_end_matches('/')),
    };

    let client = reqwest::Client::new();
    let mut req = client.get(&url);

    if !api_key.is_empty() {
        if provider == "ollama" {
            // No auth needed for Ollama
        } else {
            req = req.header("Authorization", format!("Bearer {}", api_key));
        }
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

    let models = if provider == "ollama" {
        // Ollama format: { "models": [{ "name": "..." }] }
        json["models"]
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|m| m["name"].as_str().map(|s| s.to_string()))
                    .collect()
            })
            .unwrap_or_default()
    } else if provider == "openrouter" {
        // OpenRouter format: { "data": [{ "id": "..." }] }
        json["data"]
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|m| m["id"].as_str().map(|s| s.to_string()))
                    .collect()
            })
            .unwrap_or_default()
    } else {
        // OpenAI-compatible format: { "data": [{ "id": "..." }] }
        json["data"]
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|m| m["id"].as_str().map(|s| s.to_string()))
                    .collect()
            })
            .unwrap_or_default()
    };

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
