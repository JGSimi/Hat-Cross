//! Normalização de atalhos. Forma canônica: `CommandOrControl+Alt+Shift+K`
//! (modificadores na ordem CommandOrControl, Super, Alt, Shift). Paridade
//! garantida com src/domain/shortcuts/accelerator.ts via fixture compartilhada
//! (fixtures/accelerator-cases.json).

/// Normaliza um binding para a forma canônica. Retorna None se inválido
/// (sem tecla final ou sem modificador não-Shift).
pub fn normalize(binding: &str) -> Option<String> {
    let parts: Vec<&str> = binding
        .split('+')
        .map(str::trim)
        .filter(|p| !p.is_empty())
        .collect();
    if parts.is_empty() {
        return None;
    }

    let mut cmd_or_ctrl = false;
    let mut super_mod = false;
    let mut alt = false;
    let mut shift = false;
    let mut key: Option<String> = None;

    for part in &parts {
        match part.to_ascii_lowercase().as_str() {
            "commandorcontrol" | "cmdorctrl" | "cmd" | "command" | "ctrl" | "control"
            | "meta" => cmd_or_ctrl = true,
            "super" | "win" | "windows" => super_mod = true,
            "alt" | "option" | "opt" => alt = true,
            "shift" => shift = true,
            _ => {
                if key.is_some() {
                    return None; // duas teclas finais
                }
                key = Some(normalize_key(part)?);
            }
        }
    }

    let key = key?;
    if !cmd_or_ctrl && !super_mod && !alt {
        return None; // exige ao menos um modificador não-Shift
    }

    let mut out: Vec<&str> = Vec::new();
    if cmd_or_ctrl {
        out.push("CommandOrControl");
    }
    if super_mod {
        out.push("Super");
    }
    if alt {
        out.push("Alt");
    }
    if shift {
        out.push("Shift");
    }
    out.push(&key);
    Some(out.join("+"))
}

pub fn is_valid(binding: &str) -> bool {
    normalize(binding).is_some()
}

/// Converte um W3C `KeyboardEvent.code` (ou tecla solta) em tecla canônica:
/// `KeyF` → `F`, `Digit1` → `1`, `f` → `F`, `F5` → `F5`.
fn normalize_key(raw: &str) -> Option<String> {
    let raw = raw.trim();
    if raw.is_empty() {
        return None;
    }
    if let Some(rest) = raw.strip_prefix("Key").filter(|r| r.len() == 1) {
        return Some(rest.to_ascii_uppercase());
    }
    if let Some(rest) = raw.strip_prefix("Digit").filter(|r| r.len() == 1) {
        return Some(rest.to_string());
    }
    // Teclas de função F1..F24 e nomeadas (Space, Escape…) passam como estão,
    // com inicial maiúscula; letras soltas viram maiúsculas.
    if raw.len() == 1 {
        return Some(raw.to_ascii_uppercase());
    }
    let mut chars = raw.chars();
    let first = chars.next()?.to_ascii_uppercase();
    Some(format!("{}{}", first, chars.as_str()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture() -> serde_json::Value {
        let raw = include_str!("../../../../fixtures/accelerator-cases.json");
        serde_json::from_str(raw).unwrap()
    }

    #[test]
    fn normalize_matches_shared_fixture() {
        let fx = fixture();
        let cases = fx["normalize"].as_array().unwrap();
        assert!(!cases.is_empty());
        for case in cases {
            let input = case["input"].as_str().unwrap();
            let expected = case["expected"].as_str().unwrap();
            assert_eq!(
                normalize(input).as_deref(),
                Some(expected),
                "normalize({:?})",
                input
            );
        }
    }

    #[test]
    fn validate_matches_shared_fixture() {
        let fx = fixture();
        let cases = fx["validate"].as_array().unwrap();
        assert!(!cases.is_empty());
        for case in cases {
            let input = case["input"].as_str().unwrap();
            let valid = case["valid"].as_bool().unwrap();
            assert_eq!(is_valid(input), valid, "is_valid({:?})", input);
        }
    }
}
