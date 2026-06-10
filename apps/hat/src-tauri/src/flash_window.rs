//! Janela do flash: pré-criada oculta no boot; o caminho quente do atalho
//! apenas posiciona + mostra + emite evento. Flags reaplicadas de forma
//! idempotente a cada show (config inicial não é confiável em todas as
//! plataformas — tauri#11566).

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_store::StoreExt;

use crate::macos_overlay::{apply_fullscreen_overlay, OverlayLevel};

pub const FLASH_LABEL: &str = "flash";
const CARD_W: f64 = 440.0;
const CARD_H: f64 = 200.0;
const SETTINGS_STORE: &str = "settings.json";
const POSITION_KEY: &str = "flash.position";

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct FlashPosition {
    pub x: f64,
    pub y: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub monitor_label: Option<String>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct FlashShowPayload {
    pub state: String, // "processing" | "answer" | "error"
    pub text: String,
    pub position: FlashPosition,
    /// 0–100 (stealth): opacidade do card. Quase invisível por padrão.
    pub opacity: u8,
}

const DEFAULT_OPACITY: u8 = 16;
const OPACITY_KEY: &str = "flash.opacity";

fn saved_opacity(app: &AppHandle) -> u8 {
    let Ok(store) = app.store(SETTINGS_STORE) else {
        return DEFAULT_OPACITY;
    };
    store
        .get(OPACITY_KEY)
        .and_then(|v| v.as_u64())
        .map(|v| v.clamp(0, 100) as u8)
        .unwrap_or(DEFAULT_OPACITY)
}

pub fn create_prewarmed(app: &AppHandle) -> tauri::Result<()> {
    let window = WebviewWindowBuilder::new(
        app,
        FLASH_LABEL,
        WebviewUrl::App("index.html#/flash".into()),
    )
    .title("Hat Flash")
    .inner_size(CARD_W, CARD_H)
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

    // Click-through: o card nunca captura mouse.
    let _ = window.set_ignore_cursor_events(true);
    apply_fullscreen_overlay(&window, OverlayLevel::Top);
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
            opacity: saved_opacity(app),
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
