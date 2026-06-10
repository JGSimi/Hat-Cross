//! Regras de timing e posicionamento do flash. Fonte única da fórmula —
//! o lado TS (src/domain/flash/timing.ts) valida contra a MESMA fixture
//! (fixtures/flash-timing-cases.json) para garantir paridade.

/// Tempo de exibição da resposta, proporcional ao tamanho do texto.
pub fn hold_ms_for(text_len: usize) -> u64 {
    (text_len as u64 * 34).clamp(1800, 6500)
}

/// Limita a posição do card aos limites do monitor, preservando margem.
pub fn clamp_position(
    x: f64,
    y: f64,
    card_w: f64,
    card_h: f64,
    monitor_w: f64,
    monitor_h: f64,
) -> (f64, f64) {
    let max_x = (monitor_w - card_w).max(0.0);
    let max_y = (monitor_h - card_h).max(0.0);
    (x.clamp(0.0, max_x), y.clamp(0.0, max_y))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hold_ms_matches_shared_fixture() {
        let raw = include_str!("../../../../fixtures/flash-timing-cases.json");
        let fixture: serde_json::Value = serde_json::from_str(raw).unwrap();
        let cases = fixture["cases"].as_array().unwrap();
        assert!(!cases.is_empty());
        for case in cases {
            let len = case["textLength"].as_u64().unwrap() as usize;
            let expected = case["holdMs"].as_u64().unwrap();
            assert_eq!(
                hold_ms_for(len),
                expected,
                "textLength={} deveria dar holdMs={}",
                len,
                expected
            );
        }
    }

    #[test]
    fn clamp_keeps_card_inside_monitor() {
        assert_eq!(
            clamp_position(-50.0, -10.0, 440.0, 180.0, 1920.0, 1080.0),
            (0.0, 0.0)
        );
        assert_eq!(
            clamp_position(5000.0, 5000.0, 440.0, 180.0, 1920.0, 1080.0),
            (1480.0, 900.0)
        );
        assert_eq!(
            clamp_position(100.0, 200.0, 440.0, 180.0, 1920.0, 1080.0),
            (100.0, 200.0)
        );
    }

    #[test]
    fn clamp_handles_card_larger_than_monitor() {
        assert_eq!(
            clamp_position(10.0, 10.0, 2000.0, 1200.0, 1920.0, 1080.0),
            (0.0, 0.0)
        );
    }
}
