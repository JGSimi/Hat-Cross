//! Streaming para o hat-proxy. Porte do legado com duas correções do ADR:
//! (1) guard de Drop no registry de cancelamento (sem leak em panic),
//! (2) URL com override por env (`HAT_PROXY_URL`) para testes de integração.
//! O parsing SSE vive em hat-core (puro, testado); aqui só I/O + eventos.

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use futures::StreamExt;
use hat_core::error::map_hat_proxy_error;
use hat_core::sse::{ContentType, SseEvent, SseParser};
use once_cell::sync::Lazy;
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

const DEFAULT_HAT_PROXY_URL: &str = "https://hat-proxy.joao02simi.workers.dev/v1/chat";

fn hat_proxy_url() -> String {
    std::env::var("HAT_PROXY_URL").unwrap_or_else(|_| DEFAULT_HAT_PROXY_URL.to_string())
}

static STREAM_REGISTRY: Lazy<Mutex<HashMap<u64, Arc<AtomicBool>>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

/// Remove a entrada do registry mesmo em panic/cancelamento da task.
struct StreamGuard(u64);

impl StreamGuard {
    fn register(stream_id: u64) -> (Self, Arc<AtomicBool>) {
        let flag = Arc::new(AtomicBool::new(false));
        STREAM_REGISTRY
            .lock()
            .unwrap()
            .insert(stream_id, flag.clone());
        (Self(stream_id), flag)
    }
}

impl Drop for StreamGuard {
    fn drop(&mut self) {
        STREAM_REGISTRY.lock().unwrap().remove(&self.0);
    }
}

#[derive(Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ConversationTurn {
    pub role: String,
    pub text_content: String,
    pub images: Option<Vec<String>>,
}

#[derive(Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct StreamRequest {
    pub stream_id: u64,
    pub messages: Vec<ConversationTurn>,
    pub system_prompt: String,
    pub mode: String,
    pub client_variant: Option<String>,
    pub temperature: f64,
    pub max_tokens: u32,
    #[serde(default)]
    pub images: Vec<String>,
    pub room_id: Option<String>,
    #[serde(default)]
    pub room_share: bool,
    pub source_message_id: Option<String>,
    pub id_token: String,
    pub idempotency_key: String,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct StreamChunkPayload {
    pub stream_id: u64,
    pub text: String,
    pub is_finished: bool,
    pub input_tokens: Option<u32>,
    pub output_tokens: Option<u32>,
    pub content_type: String,
}

fn emit_chunk(app: &AppHandle, payload: StreamChunkPayload) {
    let _ = app.emit("stream:chunk", payload);
}

fn finished_chunk(stream_id: u64, text: String) -> StreamChunkPayload {
    StreamChunkPayload {
        stream_id,
        text,
        is_finished: true,
        input_tokens: None,
        output_tokens: None,
        content_type: "text".into(),
    }
}

#[tauri::command]
pub fn cancel_stream(stream_id: u64) {
    if let Some(flag) = STREAM_REGISTRY.lock().unwrap().get(&stream_id) {
        flag.store(true, Ordering::SeqCst);
    }
}

#[tauri::command]
pub async fn start_stream(app: AppHandle, request: StreamRequest) -> Result<(), String> {
    let stream_id = request.stream_id;
    let (_guard, cancel_flag) = StreamGuard::register(stream_id);

    let result = run_stream(&app, &request, &cancel_flag).await;

    if let Err(e) = result {
        emit_chunk(&app, finished_chunk(stream_id, e.clone()));
        return Err(e);
    }
    Ok(())
}

/// Beta Screen Solve: usa o mesmo /v1/chat e autenticação, mas coleta o SSE
/// silenciosamente para não contaminar o Flash nem alterar o backend compartilhado.
#[tauri::command]
pub async fn complete_stream(request: StreamRequest) -> Result<String, String> {
    if request.client_variant.as_deref() != Some("beta-jev") {
        return Err("Screen Solve disponível apenas no Hat Beta.".into());
    }
    run_stream_collect(&request).await
}

fn build_body(request: &StreamRequest) -> serde_json::Value {
    // Formato OpenAI: content vira array com image_url quando há imagens no
    // último turno; o Worker traduz para o formato nativo do modelo.
    let mut api_messages = Vec::new();
    let last = request.messages.len().saturating_sub(1);
    for (i, turn) in request.messages.iter().enumerate() {
        let turn_images = turn.images.as_deref().unwrap_or(&[]);
        let combined: Vec<&str> = if i == last {
            turn_images
                .iter()
                .chain(request.images.iter())
                .map(String::as_str)
                .collect()
        } else {
            turn_images.iter().map(String::as_str).collect()
        };

        if combined.is_empty() {
            api_messages.push(serde_json::json!({
                "role": turn.role,
                "content": turn.text_content,
            }));
        } else {
            let mut parts: Vec<serde_json::Value> = combined
                .iter()
                .map(|img| {
                    let url = if img.starts_with("data:") {
                        (*img).to_string()
                    } else {
                        format!("data:image/png;base64,{}", img)
                    };
                    serde_json::json!({ "type": "image_url", "image_url": { "url": url } })
                })
                .collect();
            parts.push(serde_json::json!({ "type": "text", "text": turn.text_content }));
            api_messages.push(serde_json::json!({ "role": turn.role, "content": parts }));
        }
    }

    let mut body = serde_json::json!({
        "mode": request.mode,
        "clientVariant": request.client_variant,
        "messages": api_messages,
        "systemPrompt": request.system_prompt,
        "temperature": request.temperature,
        "maxTokens": request.max_tokens,
    });
    if request.room_share {
        body["roomShare"] = serde_json::json!(true);
    }
    if let Some(room_id) = &request.room_id {
        body["roomId"] = serde_json::json!(room_id);
    }
    if let Some(source_message_id) = &request.source_message_id {
        body["sourceMessageId"] = serde_json::json!(source_message_id);
    }
    body
}

async fn run_stream_collect(request: &StreamRequest) -> Result<String, String> {
    let mut headers = HeaderMap::new();
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
    headers.insert(
        AUTHORIZATION,
        HeaderValue::from_str(&format!("Bearer {}", request.id_token))
            .map_err(|e| format!("Token inválido: {e}"))?,
    );
    if !request.idempotency_key.is_empty() {
        if let Ok(v) = HeaderValue::from_str(&request.idempotency_key) {
            headers.insert("Idempotency-Key", v);
        }
    }

    let response = reqwest::Client::new()
        .post(hat_proxy_url()).headers(headers).json(&build_body(request))
        .send().await.map_err(|e| format!("Erro ao conectar ao Hat: {e}"))?;
    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(map_hat_proxy_error(status.as_u16(), &body));
    }

    let mut parser = SseParser::new();
    let mut bytes = response.bytes_stream();
    let mut answer = String::new();
    while let Some(chunk) = bytes.next().await {
        let chunk = chunk.map_err(|e| format!("Erro no stream: {e}"))?;
        parser.push(&chunk, |event| {
            if let SseEvent::Delta { text, content_type: ContentType::Text } = event {
                answer.push_str(&text);
            }
        });
        if parser.is_finished() { break; }
    }
    Ok(answer)
}

async fn run_stream(
    app: &AppHandle,
    request: &StreamRequest,
    cancel_flag: &Arc<AtomicBool>,
) -> Result<(), String> {
    let mut headers = HeaderMap::new();
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
    headers.insert(
        AUTHORIZATION,
        HeaderValue::from_str(&format!("Bearer {}", request.id_token))
            .map_err(|e| format!("Token inválido: {}", e))?,
    );
    if !request.idempotency_key.is_empty() {
        if let Ok(v) = HeaderValue::from_str(&request.idempotency_key) {
            headers.insert("Idempotency-Key", v);
        }
    }

    let response = reqwest::Client::new()
        .post(hat_proxy_url())
        .headers(headers)
        .json(&build_body(request))
        .send()
        .await
        .map_err(|e| format!("Erro ao conectar ao Hat: {}", e))?;

    let status = response.status();
    if !status.is_success() {
        let body_text = response.text().await.unwrap_or_default();
        return Err(map_hat_proxy_error(status.as_u16(), &body_text));
    }

    let stream_id = request.stream_id;
    let mut parser = SseParser::new();
    let mut byte_stream = response.bytes_stream();

    while let Some(chunk) = byte_stream.next().await {
        if cancel_flag.load(Ordering::SeqCst) {
            emit_chunk(app, finished_chunk(stream_id, String::new()));
            return Ok(());
        }
        let chunk = chunk.map_err(|e| format!("Erro no stream: {}", e))?;
        parser.push(&chunk, |event| match event {
            SseEvent::Delta { text, content_type } => emit_chunk(
                app,
                StreamChunkPayload {
                    stream_id,
                    text,
                    is_finished: false,
                    input_tokens: None,
                    output_tokens: None,
                    content_type: match content_type {
                        ContentType::Text => "text".into(),
                        ContentType::Thinking => "thinking".into(),
                    },
                },
            ),
            SseEvent::Usage {
                input_tokens,
                output_tokens,
            } => emit_chunk(
                app,
                StreamChunkPayload {
                    stream_id,
                    text: String::new(),
                    is_finished: false,
                    input_tokens,
                    output_tokens,
                    content_type: "text".into(),
                },
            ),
            SseEvent::Done => emit_chunk(app, finished_chunk(stream_id, String::new())),
        });
        if parser.is_finished() {
            return Ok(());
        }
    }

    emit_chunk(app, finished_chunk(stream_id, String::new()));
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn beta_variant_is_forwarded_to_proxy() {
        let request = StreamRequest {
            stream_id: 1,
            messages: vec![ConversationTurn {
                role: "user".into(),
                text_content: "pergunta".into(),
                images: None,
            }],
            system_prompt: "responda".into(),
            mode: "hat".into(),
            client_variant: Some("beta-jev".into()),
            temperature: 0.7,
            max_tokens: 128,
            images: vec![],
            room_id: None,
            room_share: false,
            source_message_id: None,
            id_token: "token".into(),
            idempotency_key: "key".into(),
        };

        assert_eq!(build_body(&request)["clientVariant"], "beta-jev");
    }
}
