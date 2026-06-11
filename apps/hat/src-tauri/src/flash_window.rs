//! Janela do flash: pré-criada oculta no boot; o caminho quente do atalho
//! apenas posiciona + mostra + emite evento. Flags reaplicadas de forma
//! idempotente a cada show (config inicial não é confiável em todas as
//! plataformas — tauri#11566).

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_store::StoreExt;

use crate::macos_overlay::{apply_fullscreen_overlay, OverlayLevel};

pub const FLASH_LABEL: &str = "flash";
pub const GABARITO_LABEL: &str = "gabarito";
const CARD_W: f64 = 440.0;
const CARD_H: f64 = 200.0;
const GABARITO_H: f64 = 300.0;
const GABARITO_GAP: f64 = 10.0;
const SETTINGS_STORE: &str = "settings.json";
const POSITION_KEY: &str = "flash.position";

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct FlashPosition {
    pub x: f64,
    pub y: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub monitor_label: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct FlashAppearance {
    /// 0–100 (stealth): opacidade do card. Quase invisível por padrão.
    pub opacity: u8,
    /// Desenhar o fundo do card? Se false, só o texto aparece (mais furtivo).
    pub background: bool,
    /// Cor do fundo (hex). Aplicada com a opacidade.
    pub bg_color: String,
    /// Cor do texto (hex).
    pub text_color: String,
}

impl Default for FlashAppearance {
    fn default() -> Self {
        Self {
            opacity: 16,
            background: true,
            bg_color: "#090908".into(),
            text_color: "#f6f6f4".into(),
        }
    }
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct FlashShowPayload {
    pub state: String, // "processing" | "answer" | "error"
    pub text: String,
    pub position: FlashPosition,
    #[serde(flatten)]
    pub appearance: FlashAppearance,
}

const OPACITY_KEY: &str = "flash.opacity";
const BACKGROUND_KEY: &str = "flash.background";
const BG_COLOR_KEY: &str = "flash.bgColor";
const TEXT_COLOR_KEY: &str = "flash.textColor";

fn saved_appearance(app: &AppHandle) -> FlashAppearance {
    let d = FlashAppearance::default();
    let Ok(store) = app.store(SETTINGS_STORE) else {
        return d;
    };
    FlashAppearance {
        opacity: store
            .get(OPACITY_KEY)
            .and_then(|v| v.as_u64())
            .map(|v| v.clamp(0, 100) as u8)
            .unwrap_or(d.opacity),
        background: store
            .get(BACKGROUND_KEY)
            .and_then(|v| v.as_bool())
            .unwrap_or(d.background),
        bg_color: store
            .get(BG_COLOR_KEY)
            .and_then(|v| v.as_str().map(String::from))
            .unwrap_or(d.bg_color),
        text_color: store
            .get(TEXT_COLOR_KEY)
            .and_then(|v| v.as_str().map(String::from))
            .unwrap_or(d.text_color),
    }
}

#[tauri::command]
pub fn get_flash_appearance(app: AppHandle) -> FlashAppearance {
    saved_appearance(&app)
}

#[tauri::command]
pub fn set_flash_appearance(app: AppHandle, appearance: FlashAppearance) -> Result<(), String> {
    let store = app.store(SETTINGS_STORE).map_err(|e| e.to_string())?;
    store.set(OPACITY_KEY, serde_json::json!(appearance.opacity.min(100)));
    store.set(BACKGROUND_KEY, serde_json::json!(appearance.background));
    store.set(BG_COLOR_KEY, serde_json::json!(appearance.bg_color));
    store.set(TEXT_COLOR_KEY, serde_json::json!(appearance.text_color));
    Ok(())
}

/// Cria um overlay (flash ou gabarito): transparente, click-through, topmost,
/// content-protected, oculto e pré-aquecido. Mesmo tratamento stealth.
fn build_overlay(
    app: &AppHandle,
    label: &str,
    route: &str,
    w: f64,
    h: f64,
) -> tauri::Result<()> {
    let window = WebviewWindowBuilder::new(app, label, WebviewUrl::App(route.into()))
        .title("Hat")
        .inner_size(w, h)
        .visible(false)
        .transparent(true)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .focused(false)
        .resizable(false)
        .shadow(false)
        .accept_first_mouse(false)
        .visible_on_all_workspaces(true)
        .content_protected(true)
        .build()?;
    let _ = window.set_ignore_cursor_events(true);
    apply_fullscreen_overlay(&window, OverlayLevel::Top);
    Ok(())
}

pub fn create_prewarmed(app: &AppHandle) -> tauri::Result<()> {
    build_overlay(app, FLASH_LABEL, "index.html#/flash", CARD_W, CARD_H)?;
    build_overlay(app, GABARITO_LABEL, "index.html#/gabarito", CARD_W, GABARITO_H)?;
    Ok(())
}

/// Lê a posição salva (síncrono, no Rust — evita a corrida de settings
/// debounced do legado).
fn saved_position(app: &AppHandle) -> FlashPosition {
    let fallback = FlashPosition {
        x: 24.0,
        y: 24.0,
        monitor_label: None,
    };
    let Ok(store) = app.store(SETTINGS_STORE) else {
        return fallback;
    };
    store
        .get(POSITION_KEY)
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or(fallback)
}

/// Caminho quente: posiciona, reaplica flags topmost/protected (idempotente),
/// mostra SEM foco e emite o payload para o webview já vivo.
pub fn show(app: &AppHandle, state: &str, text: &str) {
    let Some(window) = app.get_webview_window(FLASH_LABEL) else {
        return;
    };
    let mut position = saved_position(app);
    if let Ok(Some(monitor)) = window.current_monitor() {
        let size = monitor.size();
        let scale = monitor.scale_factor();
        let (x, y) = hat_core::flash::clamp_position(
            position.x,
            position.y,
            CARD_W,
            CARD_H,
            size.width as f64 / scale,
            size.height as f64 / scale,
        );
        position.x = x;
        position.y = y;
    }

    let _ = window.set_position(tauri::LogicalPosition::new(position.x, position.y));
    // Reaplicação paranoica a cada show (lição do legado/pesquisa).
    let _ = window.set_always_on_top(true);
    let _ = window.set_content_protected(true);
    let _ = window.set_ignore_cursor_events(true);
    apply_fullscreen_overlay(&window, OverlayLevel::Top);
    let _ = window.show();

    let _ = app.emit(
        "flash:show",
        FlashShowPayload {
            state: state.to_string(),
            text: text.to_string(),
            position,
            appearance: saved_appearance(app),
        },
    );
}

pub fn hide(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(FLASH_LABEL) {
        let _ = window.hide();
    }
    let _ = app.emit("flash:hide", ());
}

#[tauri::command]
pub fn flash_hide(app: AppHandle) {
    hide(&app);
}

/// Mostra o Flash com um texto pronto (correção da sala, sob demanda).
/// Estado "answer" → a FlashPage aplica o auto-hide pelo holdMs.
#[tauri::command]
pub fn flash_show_text(app: AppHandle, text: String) {
    show(&app, "answer", &text);
}

// ───────────────────────────── Gabarito ──────────────────────────────────
// Overlay PERSISTENTE abaixo do flash, mesma config visual. Mostra as
// respostas corrigidas (consenso da IA) da sala. Toggle por atalho.

#[derive(Deserialize, Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GabaritoItem {
    pub question: String,
    pub answer: String,
    pub diverged: bool,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct GabaritoPayload {
    items: Vec<GabaritoItem>,
    appearance: FlashAppearance,
}

#[tauri::command]
pub fn gabarito_show(app: AppHandle, items: Vec<GabaritoItem>) {
    let Some(window) = app.get_webview_window(GABARITO_LABEL) else {
        return;
    };
    let pos = saved_position(&app);
    let mut x = pos.x;
    // Abaixo do flash.
    let mut y = pos.y + CARD_H + GABARITO_GAP;
    if let Ok(Some(monitor)) = window.current_monitor() {
        let size = monitor.size();
        let scale = monitor.scale_factor();
        let (cx, cy) = hat_core::flash::clamp_position(
            x,
            y,
            CARD_W,
            GABARITO_H,
            size.width as f64 / scale,
            size.height as f64 / scale,
        );
        x = cx;
        y = cy;
    }
    let _ = window.set_position(tauri::LogicalPosition::new(x, y));
    let _ = window.set_always_on_top(true);
    let _ = window.set_content_protected(true);
    let _ = window.set_ignore_cursor_events(true);
    apply_fullscreen_overlay(&window, OverlayLevel::Top);
    let _ = window.show();
    let _ = app.emit(
        "gabarito:show",
        GabaritoPayload {
            items,
            appearance: saved_appearance(&app),
        },
    );
}

#[tauri::command]
pub fn gabarito_hide(app: AppHandle) {
    if let Some(window) = app.get_webview_window(GABARITO_LABEL) {
        let _ = window.hide();
    }
}

#[tauri::command]
pub fn flash_enter_adjust_mode(app: AppHandle) {
    // Modo de ajuste: card visível e interativo para arrastar.
    if let Some(window) = app.get_webview_window(FLASH_LABEL) {
        let _ = window.set_ignore_cursor_events(false);
        let _ = window.show();
    }
    let _ = app.emit("flash:adjust-mode", ());
}

#[tauri::command]
pub fn flash_save_position(app: AppHandle, position: FlashPosition) -> Result<(), String> {
    let store = app.store(SETTINGS_STORE).map_err(|e| e.to_string())?;
    store.set(
        POSITION_KEY,
        serde_json::to_value(&position).map_err(|e| e.to_string())?,
    );
    // Sai do modo de ajuste: volta a ser click-through.
    if let Some(window) = app.get_webview_window(FLASH_LABEL) {
        let _ = window.set_ignore_cursor_events(true);
        let _ = window.hide();
    }
    Ok(())
}
