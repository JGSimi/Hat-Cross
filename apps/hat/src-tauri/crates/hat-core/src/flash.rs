//! Regras de timing e posicionamento do flash. Fonte única da fórmula —
//! o lado TS (src/domain/flash/timing.ts) valida contra a MESMA fixture
//! (fixtures/flash-timing-cases.json) para garantir paridade.

use serde::{Deserialize, Serialize};

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

// ───────────────────────── Área do Flash ─────────────────────────────────
// O usuário escolhe, arrastando a área verde, quanto da tela o Flash pode
// usar. A área é guardada em frações da tela (0–1). Mesma fórmula do lado TS
// (src/domain/flash/area.ts), validada por fixtures/flash-area-cases.json.


/// Menor área permitida (fração da tela).
pub const MIN_AREA_W: f64 = 0.15;
pub const MIN_AREA_H: f64 = 0.1;
/// Menor janela permitida (px lógicos), limitada ao monitor.
pub const MIN_RECT_W: f64 = 240.0;
pub const MIN_RECT_H: f64 = 72.0;
const EDGE: f64 = 0.02;
const DEFAULT_W: f64 = 0.3;
const DEFAULT_H: f64 = 0.22;

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq)]
pub struct FlashArea {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq)]
pub struct PixelRect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

fn round4(v: f64) -> f64 {
    (v * 10_000.0).round() / 10_000.0
}

fn finite_or(v: f64, fallback: f64) -> f64 {
    if v.is_finite() {
        v
    } else {
        fallback
    }
}

/// Área padrão colada no canto pedido (também migra o seletor antigo).
pub fn area_from_quadrant(quadrant: &str) -> FlashArea {
    let right = matches!(quadrant, "top-right" | "bottom-right");
    let bottom = matches!(quadrant, "bottom-left" | "bottom-right");
    FlashArea {
        x: round4(if right { 1.0 - EDGE - DEFAULT_W } else { EDGE }),
        y: round4(if bottom { 1.0 - EDGE - DEFAULT_H } else { EDGE }),
        w: DEFAULT_W,
        h: DEFAULT_H,
    }
}

/// Posição livre antiga (sem quadrante) → canto mais próximo. Mesma regra
/// que a UI antiga usava para destacar o quadrante (x/y > 300).
pub fn quadrant_from_legacy_position(x: f64, y: f64) -> &'static str {
    match (x > 300.0, y > 300.0) {
        (true, true) => "bottom-right",
        (true, false) => "top-right",
        (false, true) => "bottom-left",
        (false, false) => "top-left",
    }
}

pub fn default_area() -> FlashArea {
    area_from_quadrant("top-left")
}

/// Tamanho mínimo e área inteira dentro da tela.
pub fn clamp_area(area: &FlashArea) -> FlashArea {
    let d = default_area();
    let w = round4(finite_or(area.w, d.w).clamp(MIN_AREA_W, 1.0));
    let h = round4(finite_or(area.h, d.h).clamp(MIN_AREA_H, 1.0));
    FlashArea {
        x: round4(finite_or(area.x, d.x).clamp(0.0, 1.0 - w)),
        y: round4(finite_or(area.y, d.y).clamp(0.0, 1.0 - h)),
        w,
        h,
    }
}

/// Área → retângulo da janela em pixels lógicos do monitor.
pub fn area_to_rect(area: &FlashArea, monitor_w: f64, monitor_h: f64) -> PixelRect {
    let a = clamp_area(area);
    let width = (a.w * monitor_w).round().max(MIN_RECT_W).min(monitor_w);
    let height = (a.h * monitor_h).round().max(MIN_RECT_H).min(monitor_h);
    PixelRect {
        x: (a.x * monitor_w).round().clamp(0.0, (monitor_w - width).max(0.0)),
        y: (a.y * monitor_h).round().clamp(0.0, (monitor_h - height).max(0.0)),
        width,
        height,
    }
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
    fn area_to_rect_matches_shared_fixture() {
        let raw = include_str!("../../../../fixtures/flash-area-cases.json");
        let fixture: serde_json::Value = serde_json::from_str(raw).unwrap();
        let cases = fixture["rectCases"].as_array().unwrap();
        assert!(!cases.is_empty());
        for case in cases {
            let area: FlashArea = serde_json::from_value(case["area"].clone()).unwrap();
            let mw = case["monitor"]["w"].as_f64().unwrap();
            let mh = case["monitor"]["h"].as_f64().unwrap();
            let expected: PixelRect = serde_json::from_value(case["rect"].clone()).unwrap();
            assert_eq!(
                area_to_rect(&area, mw, mh),
                expected,
                "caso: {}",
                case["name"]
            );
        }
    }

    #[test]
    fn area_from_quadrant_matches_shared_fixture() {
        let raw = include_str!("../../../../fixtures/flash-area-cases.json");
        let fixture: serde_json::Value = serde_json::from_str(raw).unwrap();
        for case in fixture["quadrantCases"].as_array().unwrap() {
            let quadrant = case["quadrant"].as_str().unwrap();
            let expected: FlashArea = serde_json::from_value(case["area"].clone()).unwrap();
            assert_eq!(area_from_quadrant(quadrant), expected, "quadrante {}", quadrant);
        }
    }

    #[test]
    fn clamp_area_keeps_min_size_and_inside_screen() {
        let a = clamp_area(&FlashArea { x: 0.9, y: 2.0, w: 0.0, h: 0.5 });
        assert_eq!(a.w, MIN_AREA_W);
        assert!(a.x + a.w <= 1.0);
        assert!(a.y + a.h <= 1.0);
        let nan = clamp_area(&FlashArea { x: f64::NAN, y: f64::INFINITY, w: 0.4, h: 0.3 });
        assert_eq!(nan, FlashArea { x: 0.02, y: 0.02, w: 0.4, h: 0.3 });
    }

    #[test]
    fn legacy_free_position_maps_to_nearest_corner() {
        // Mesma regra da UI antiga: x > 300 é direita, y > 300 é embaixo.
        assert_eq!(quadrant_from_legacy_position(24.0, 24.0), "top-left");
        assert_eq!(quadrant_from_legacy_position(1456.0, 24.0), "top-right");
        assert_eq!(quadrant_from_legacy_position(24.0, 856.0), "bottom-left");
        assert_eq!(quadrant_from_legacy_position(1456.0, 856.0), "bottom-right");
        assert_eq!(quadrant_from_legacy_position(300.0, 300.0), "top-left");
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
