use serde::Serialize;
use serde_json::json;
use std::collections::HashMap;
use std::net::{Ipv4Addr, SocketAddrV4, TcpListener as StdTcpListener};
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener as TokioTcpListener;
use tokio::time::{timeout, Duration};

#[derive(Debug, Serialize, Clone)]
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
<body><div class="box"><h1>Login conclu&iacute;do &check;</h1><p>Pode fechar essa janela e voltar pro Hat.</p></div></body></html>"#;

// Starts a one-shot loopback HTTP server on a random port, returns the port
// immediately. When the Google OAuth redirect hits the listener with `code` and
// `state` query params, emits `oauth-callback`; on error (user denied, timeout,
// malformed request) emits `oauth-error`. The server shuts down after handling
// exactly one request either way.
#[tauri::command]
pub async fn oauth_start_server(app: AppHandle) -> Result<u16, String> {
    eprintln!("[oauth] bind_start");
    crate::commands::diagnostic_log_event(&app, "oauth_start_server_start", json!({}));
    let (listener, port) = bind_loopback_listener().map_err(|e| format!("Bind failed: {}", e))?;
    eprintln!("[oauth] bind_ok port={}", port);
    crate::commands::diagnostic_log_event(&app, "oauth_start_server_ok", json!({ "port": port }));

    let app_handle = app.clone();
    tokio::spawn(async move {
        match handle_oauth_callback(listener).await {
            Ok(payload) => {
                crate::commands::diagnostic_log_event(
                    &app_handle,
                    "oauth_callback_received",
                    json!({ "stateLen": payload.state.len(), "codeLen": payload.code.len() }),
                );
                let _ = app_handle.emit("oauth-callback", payload);
            }
            Err(err) => {
                crate::commands::diagnostic_log_event(
                    &app_handle,
                    "oauth_callback_error",
                    json!({ "error": err }),
                );
                let _ = app_handle.emit("oauth-error", OAuthErrorPayload { error: err });
            }
        }
    });
    eprintln!("[oauth] callback_task_spawned");

    Ok(port)
}

fn bind_loopback_listener() -> Result<(TokioTcpListener, u16), String> {
    let addr = SocketAddrV4::new(Ipv4Addr::LOCALHOST, 0);
    let std_listener = StdTcpListener::bind(addr).map_err(|e| e.to_string())?;
    std_listener
        .set_nonblocking(true)
        .map_err(|e| format!("set_nonblocking failed: {}", e))?;
    let port = std_listener
        .local_addr()
        .map_err(|e| format!("Local addr failed: {}", e))?
        .port();
    let listener =
        TokioTcpListener::from_std(std_listener).map_err(|e| format!("from_std failed: {}", e))?;
    Ok((listener, port))
}

// Opens a URL in the user's default system browser. OS-specific shell-out,
// no extra crate dep. Used to launch the Google OAuth consent page during
// the loopback flow.
#[tauri::command]
pub fn open_external_url(app: AppHandle, url: String) -> Result<(), String> {
    let safe_url = redact_url_for_log(&url);
    crate::commands::diagnostic_log_event(
        &app,
        "open_external_url_start",
        json!({ "url": safe_url }),
    );
    let spawn_result = if cfg!(target_os = "macos") {
        std::process::Command::new("open").arg(&url).spawn()
    } else if cfg!(target_os = "windows") {
        // Avoid `cmd /c start`: OAuth URLs contain `&`, which cmd.exe treats as
        // command separators unless every metacharacter is quoted perfectly.
        std::process::Command::new("rundll32.exe")
            .args(["url.dll,FileProtocolHandler", &url])
            .spawn()
    } else {
        std::process::Command::new("xdg-open").arg(&url).spawn()
    };
    match spawn_result {
        Ok(_) => {
            eprintln!("[oauth] external_url_spawned url={}", safe_url);
            crate::commands::diagnostic_log_event(
                &app,
                "open_external_url_ok",
                json!({ "url": safe_url }),
            );
            Ok(())
        }
        Err(e) => {
            crate::commands::diagnostic_log_event(
                &app,
                "open_external_url_error",
                json!({ "url": safe_url, "error": e.to_string() }),
            );
            Err(format!("Failed to open URL: {}", e))
        }
    }
}

async fn handle_oauth_callback(listener: TokioTcpListener) -> Result<OAuthCallbackPayload, String> {
    let (mut stream, _) = timeout(Duration::from_secs(60), listener.accept())
        .await
        .map_err(|_| "OAuth callback listener timed out".to_string())?
        .map_err(|e| format!("Accept failed: {}", e))?;

    let mut buf = vec![0u8; 8192];
    let n = stream
        .read(&mut buf)
        .await
        .map_err(|e| format!("Read failed: {}", e))?;

    let request =
        std::str::from_utf8(&buf[..n]).map_err(|e| format!("Invalid UTF-8 in request: {}", e))?;

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

    let code = params
        .get("code")
        .ok_or("Missing `code` in redirect")?
        .clone();
    let state = params
        .get("state")
        .ok_or("Missing `state` in redirect")?
        .clone();

    Ok(OAuthCallbackPayload { code, state })
}

#[cfg(test)]
mod tests {
    use super::{bind_loopback_listener, handle_oauth_callback, redact_url_for_log};
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpStream;

    #[tokio::test]
    async fn binds_loopback_listener_on_random_port() {
        let (_listener, port) = bind_loopback_listener().expect("loopback bind should work");
        assert!(port > 0);
    }

    #[tokio::test]
    async fn parses_successful_loopback_callback() {
        let (listener, port) = bind_loopback_listener().expect("loopback bind should work");
        let task = tokio::spawn(handle_oauth_callback(listener));

        let mut stream = TcpStream::connect(("127.0.0.1", port))
            .await
            .expect("callback connect should work");
        stream
            .write_all(b"GET /oauth/callback?code=abc123&state=state+one HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n")
            .await
            .expect("request write should work");
        let mut response = vec![0; 128];
        let _ = stream.read(&mut response).await;

        let payload = task.await.expect("task should join").expect("callback should parse");
        assert_eq!(payload.code, "abc123");
        assert_eq!(payload.state, "state one");
    }

    #[tokio::test]
    async fn surfaces_oauth_access_denied() {
        let (listener, port) = bind_loopback_listener().expect("loopback bind should work");
        let task = tokio::spawn(handle_oauth_callback(listener));

        let mut stream = TcpStream::connect(("127.0.0.1", port))
            .await
            .expect("callback connect should work");
        stream
            .write_all(b"GET /oauth/callback?error=access_denied&state=ignored HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n")
            .await
            .expect("request write should work");
        let mut response = vec![0; 128];
        let _ = stream.read(&mut response).await;

        let error = task.await.expect("task should join").expect_err("error should surface");
        assert_eq!(error, "OAuth rejected: access_denied");
    }

    #[tokio::test]
    async fn rejects_loopback_callback_without_code() {
        let (listener, port) = bind_loopback_listener().expect("loopback bind should work");
        let task = tokio::spawn(handle_oauth_callback(listener));

        let mut stream = TcpStream::connect(("127.0.0.1", port))
            .await
            .expect("callback connect should work");
        stream
            .write_all(b"GET /oauth/callback?state=ok HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n")
            .await
            .expect("request write should work");
        let mut response = vec![0; 128];
        let _ = stream.read(&mut response).await;

        let error = task.await.expect("task should join").expect_err("error should surface");
        assert_eq!(error, "Missing `code` in redirect");
    }

    #[test]
    fn redacts_oauth_url_query_for_logs() {
        assert_eq!(
            redact_url_for_log("https://accounts.google.com/o/oauth2/v2/auth?client_id=secret&state=s"),
            "https://accounts.google.com/o/oauth2/v2/auth?<redacted>",
        );
    }
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

fn redact_url_for_log(input: &str) -> String {
    input
        .split_once('?')
        .map(|(base, _)| format!("{}?<redacted>", base))
        .unwrap_or_else(|| input.to_string())
}
