//! Fluxo OAuth de desktop: servidor loopback one-shot + abertura do browser
//! do sistema. Porte do legado, simplificado: `oauth_run_loopback_flow` é o
//! caminho único (bloqueante — um invoke devolve o code), nos dois SOs.
//! O TS troca o code por tokens e finaliza no Firebase.

use serde::Serialize;
use std::collections::HashMap;
use std::net::{Ipv4Addr, SocketAddrV4, TcpListener as StdTcpListener};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener as TokioTcpListener;
use tokio::time::{timeout, Duration};

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct OAuthCallbackPayload {
    pub code: String,
    pub state: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct OAuthFlowResult {
    pub code: String,
    pub redirect_uri: String,
}

const CALLBACK_HTML: &str = r#"<!DOCTYPE html>
<html lang="pt-br"><head>
<meta charset="utf-8">
<title>Hat — Login concluído</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; background: #0e0e0d; color: #f4f4f2; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
  .box { text-align: center; padding: 40px 56px; border: 1px solid rgba(244,244,242,.08); border-radius: 16px; background: rgba(244,244,242,.03); }
  h1 { margin: 0 0 8px; font-size: 20px; font-weight: 600; }
  p { margin: 0; color: #a8a8a3; font-size: 13px; }
</style></head>
<body><div class="box"><h1>Login conclu&iacute;do &check;</h1><p>Pode fechar esta janela e voltar pro Hat.</p></div></body></html>"#;

/// Fluxo completo: sobe o listener loopback, abre o consentimento do Google
/// no browser do sistema e espera o redirect (até 120 s). Valida o `state`
/// (anti-CSRF) e devolve `code` + `redirect_uri` para o TS trocar por tokens.
#[tauri::command]
pub async fn oauth_run_loopback_flow(
    client_id: String,
    state: String,
    code_challenge: String,
) -> Result<OAuthFlowResult, String> {
    let (listener, port) = bind_loopback_listener()?;
    let redirect_uri = format!("http://127.0.0.1:{}/oauth/callback", port);
    let auth_url = build_google_auth_url(&client_id, &redirect_uri, &state, &code_challenge);

    open_external_url(auth_url)?;

    let payload = timeout(Duration::from_secs(120), handle_oauth_callback(listener))
        .await
        .map_err(|_| "Google não respondeu em 2 minutos.".to_string())??;

    if payload.state != state {
        return Err("State mismatch (possível CSRF)".to_string());
    }

    Ok(OAuthFlowResult {
        code: payload.code,
        redirect_uri,
    })
}

fn build_google_auth_url(
    client_id: &str,
    redirect_uri: &str,
    state: &str,
    code_challenge: &str,
) -> String {
    format!(
        "https://accounts.google.com/o/oauth2/v2/auth?client_id={}&redirect_uri={}&response_type=code&scope=openid%20email%20profile&state={}&code_challenge={}&code_challenge_method=S256&prompt=select_account",
        url_encode_query_value(client_id),
        url_encode_query_value(redirect_uri),
        url_encode_query_value(state),
        url_encode_query_value(code_challenge),
    )
}

fn url_encode_query_value(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for byte in input.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(byte as char)
            }
            _ => out.push_str(&format!("%{:02X}", byte)),
        }
    }
    out
}

fn bind_loopback_listener() -> Result<(TokioTcpListener, u16), String> {
    let addr = SocketAddrV4::new(Ipv4Addr::LOCALHOST, 0);
    let std_listener = StdTcpListener::bind(addr).map_err(|e| format!("Bind failed: {}", e))?;
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

/// Abre uma URL no browser padrão (ex.: checkout Stripe, página de assinatura).
#[tauri::command]
pub fn open_external(url: String) -> Result<(), String> {
    open_external_url(url)
}

/// Abre uma URL no browser padrão. Shell-out por SO, sem crate extra.
/// No Windows evita `cmd /c start`: URLs OAuth têm `&`, que o cmd.exe trata
/// como separador de comando.
fn open_external_url(url: String) -> Result<(), String> {
    let spawn_result = if cfg!(target_os = "macos") {
        std::process::Command::new("open").arg(&url).spawn()
    } else if cfg!(target_os = "windows") {
        std::process::Command::new("rundll32.exe")
            .args(["url.dll,FileProtocolHandler", &url])
            .spawn()
    } else {
        std::process::Command::new("xdg-open").arg(&url).spawn()
    };
    spawn_result
        .map(|_| ())
        .map_err(|e| format!("Failed to open URL: {}", e))
}

async fn handle_oauth_callback(listener: TokioTcpListener) -> Result<OAuthCallbackPayload, String> {
    let (mut stream, _) = timeout(Duration::from_secs(120), listener.accept())
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

    // Sempre responde ao browser, mesmo em erro — página amigável em vez de
    // aba morta.
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

// Decoder mínimo de application/x-www-form-urlencoded (`+` e `%HH`).
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

#[cfg(test)]
mod tests {
    use super::{bind_loopback_listener, build_google_auth_url, handle_oauth_callback};
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
            .write_all(
                b"GET /oauth/callback?code=abc123&state=state+one HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n",
            )
            .await
            .expect("request write should work");
        let mut response = vec![0; 128];
        let _ = stream.read(&mut response).await;

        let payload = task
            .await
            .expect("task should join")
            .expect("callback should parse");
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
            .write_all(
                b"GET /oauth/callback?error=access_denied&state=x HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n",
            )
            .await
            .expect("request write should work");
        let mut response = vec![0; 128];
        let _ = stream.read(&mut response).await;

        let error = task
            .await
            .expect("task should join")
            .expect_err("error should surface");
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

        let error = task
            .await
            .expect("task should join")
            .expect_err("error should surface");
        assert_eq!(error, "Missing `code` in redirect");
    }

    #[test]
    fn auth_url_encodes_query_values() {
        let url = build_google_auth_url(
            "id with space",
            "http://127.0.0.1:9/oauth/callback",
            "st&ate",
            "chall",
        );
        assert!(url.contains("client_id=id%20with%20space"));
        assert!(url.contains("redirect_uri=http%3A%2F%2F127.0.0.1%3A9%2Foauth%2Fcallback"));
        assert!(url.contains("state=st%26ate"));
        assert!(url.contains("code_challenge_method=S256"));
    }
}
