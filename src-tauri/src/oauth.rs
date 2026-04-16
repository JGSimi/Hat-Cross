use serde::Serialize;
use std::collections::HashMap;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct OAuthCallbackPayload {
    pub code: String,
    pub state: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct OAuthErrorPayload {
    pub error: String,
}

const CALLBACK_HTML: &str = r#"<!DOCTYPE html>
<html lang="pt-br"><head>
<meta charset="utf-8">
<title>Hat — Login concluido</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; background: #0C0C0E; color: #EEEEF0; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
  .box { text-align: center; padding: 40px 56px; border: 1px solid rgba(255,255,255,.08); border-radius: 16px; background: rgba(255,255,255,.03); }
  h1 { margin: 0 0 8px; font-size: 20px; font-weight: 600; }
  p { margin: 0; color: #9E9EA5; font-size: 13px; }
</style></head>
<body><div class="box"><h1>Login concluido &check;</h1><p>Pode fechar essa janela e voltar pro Hat.</p></div></body></html>"#;

// Starts a one-shot loopback HTTP server on a random port, returns the port
// immediately. When the Google OAuth redirect hits the listener with `code` and
// `state` query params, emits `oauth-callback`; on error (user denied, timeout,
// malformed request) emits `oauth-error`. The server shuts down after handling
// exactly one request either way.
#[tauri::command]
pub async fn oauth_start_server(app: AppHandle) -> Result<u16, String> {
    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|e| format!("Bind failed: {}", e))?;
    let port = listener
        .local_addr()
        .map_err(|e| format!("Local addr failed: {}", e))?
        .port();

    let app_handle = app.clone();
    tokio::spawn(async move {
        match handle_oauth_callback(listener).await {
            Ok(payload) => {
                let _ = app_handle.emit("oauth-callback", payload);
            }
            Err(err) => {
                let _ = app_handle.emit("oauth-error", OAuthErrorPayload { error: err });
            }
        }
    });

    Ok(port)
}

// Opens a URL in the user's default system browser. OS-specific shell-out,
// no extra crate dep. Used to launch the Google OAuth consent page during
// the loopback flow.
#[tauri::command]
pub fn open_external_url(url: String) -> Result<(), String> {
    let spawn_result = if cfg!(target_os = "macos") {
        std::process::Command::new("open").arg(&url).spawn()
    } else if cfg!(target_os = "windows") {
        // `start` via cmd.exe; empty "" is the window title arg so URLs with
        // spaces (unlikely) don't get swallowed.
        std::process::Command::new("cmd")
            .args(["/c", "start", "", &url])
            .spawn()
    } else {
        std::process::Command::new("xdg-open").arg(&url).spawn()
    };
    spawn_result
        .map(|_| ())
        .map_err(|e| format!("Failed to open URL: {}", e))
}

async fn handle_oauth_callback(listener: TcpListener) -> Result<OAuthCallbackPayload, String> {
    let (mut stream, _) = listener
        .accept()
        .await
        .map_err(|e| format!("Accept failed: {}", e))?;

    let mut buf = vec![0u8; 8192];
    let n = stream
        .read(&mut buf)
        .await
        .map_err(|e| format!("Read failed: {}", e))?;

    let request = std::str::from_utf8(&buf[..n])
        .map_err(|e| format!("Invalid UTF-8 in request: {}", e))?;

    let first_line = request.lines().next().ok_or("Empty request")?;
    let path = first_line
        .split_whitespace()
        .nth(1)
        .ok_or("Malformed request line")?;

    let query = path
        .split_once('?')
        .map(|(_, q)| q)
        .ok_or("No query string in redirect")?;

    let mut params: HashMap<String, String> = HashMap::new();
    for pair in query.split('&') {
        if let Some((k, v)) = pair.split_once('=') {
            params.insert(k.to_string(), url_decode(v));
        }
    }

    // Always respond to the browser, even on error, so the user sees a
    // friendly page instead of a dead tab.
    let response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        CALLBACK_HTML.len(),
        CALLBACK_HTML
    );
    let _ = stream.write_all(response.as_bytes()).await;
    let _ = stream.flush().await;
    let _ = stream.shutdown().await;

    if let Some(error) = params.get("error") {
        return Err(format!("OAuth rejected: {}", error));
    }

    let code = params.get("code").ok_or("Missing `code` in redirect")?.clone();
    let state = params
        .get("state")
        .ok_or("Missing `state` in redirect")?
        .clone();

    Ok(OAuthCallbackPayload { code, state })
}

// Minimal URL-decoder for application/x-www-form-urlencoded. OAuth codes are
// base64url-safe so %XX escapes are rare, but we handle `+` and `%HH` anyway.
fn url_decode(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut out = String::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        match bytes[i] {
            b'+' => {
                out.push(' ');
                i += 1;
            }
            b'%' if i + 2 < bytes.len() => {
                let h1 = (bytes[i + 1] as char).to_digit(16);
                let h2 = (bytes[i + 2] as char).to_digit(16);
                if let (Some(d1), Some(d2)) = (h1, h2) {
                    out.push(((d1 << 4) | d2) as u8 as char);
                    i += 3;
                } else {
                    out.push(bytes[i] as char);
                    i += 1;
                }
            }
            b => {
                out.push(b as char);
                i += 1;
            }
        }
    }
    out
}
