//! Mapa de erros HTTP do hat-proxy para CÓDIGOS estáveis (não strings
//! traduzidas) — o renderer resolve via i18n. Formato: `error:<code>[:detail]`.
//! Porte fiel do legado (testes incluídos).

pub fn map_hat_proxy_error(status: u16, body: &str) -> String {
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn session_expired_on_401() {
        assert_eq!(map_hat_proxy_error(401, ""), "error:sessionExpired");
    }

    #[test]
    fn insufficient_credits_on_402() {
        assert_eq!(map_hat_proxy_error(402, "{}"), "error:insufficientCredits");
    }

    #[test]
    fn rate_limited_on_429() {
        assert_eq!(map_hat_proxy_error(429, "{}"), "error:rateLimited");
    }

    #[test]
    fn model_deprecation_maps_to_upstream_unavailable() {
        let body = r#"{"error":"model x is deprecated. Use another."}"#;
        assert_eq!(
            map_hat_proxy_error(400, body),
            "error:serverError:400:upstream-model-unavailable"
        );
    }

    #[test]
    fn model_not_found_maps_to_upstream_unavailable() {
        let body = r#"{"error":"models/x is not found"}"#;
        assert_eq!(
            map_hat_proxy_error(404, body),
            "error:serverError:404:upstream-model-unavailable"
        );
    }

    #[test]
    fn plain_bad_request_stays_unknown() {
        let body = r#"{"error":"bad request"}"#;
        assert_eq!(
            map_hat_proxy_error(400, body),
            "error:unknownError:400:bad request"
        );
    }

    #[test]
    fn server_error_carries_status_and_detail() {
        let body = r#"{"error":"boom"}"#;
        assert_eq!(map_hat_proxy_error(503, body), "error:serverError:503:boom");
    }
}
