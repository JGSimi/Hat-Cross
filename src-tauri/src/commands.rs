use serde::Serialize;
use serde_json::{json, Value};
use std::fs::OpenOptions;
use std::io::Write;
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition};

use crate::windows;

#[derive(Debug, Clone, Serialize, serde::Deserialize)]
pub struct FlashPosition {
    pub x: i32,
    pub y: i32,
}

#[derive(Debug, Clone, Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FlashTiming {
    pub mode: String,
    pub fade_in_ms: u32,
    pub fade_out_ms: u32,
    pub hold_ms: Option<u32>,
}

#[derive(Debug, Clone, Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FlashAppearance {
    pub color: String,
    pub opacity: u32,
    pub font_size_px: u32,
    pub text_shadow: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FlashShowPayload {
    pub text: String,
    pub timing: FlashTiming,
    pub appearance: FlashAppearance,
    pub stream_id: u64,
}

// Post-BYOK: the in-memory API_KEYS HashMap and the set/get provider-key
// commands are gone. Every LLM call now goes through the Hat proxy Worker,
// which holds the server-side Gemini key and never lets it touch the client.

pub(crate) fn diagnostic_log_event(app: &AppHandle, event: &str, fields: Value) {
    let payload = json!({
        "ts": chrono_like_now_ms(),
        "event": event,
        "platform": std::env::consts::OS,
        "version": app.package_info().version.to_string(),
        "fields": fields,
    });

    if let Err(err) = append_diagnostic_line(app, &payload.to_string()) {
        eprintln!("[diagnostic] write failed: {}", err);
    }
}

#[tauri::command]
pub fn diagnostic_log(app: AppHandle, event: String, fields: Option<Value>) -> Result<(), String> {
    diagnostic_log_event(&app, &event, fields.unwrap_or_else(|| json!({})));
    Ok(())
}

fn append_diagnostic_line(app: &AppHandle, line: &str) -> Result<(), String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir failed: {}", e))?;
    let log_dir = app_data_dir.join("logs");
    std::fs::create_dir_all(&log_dir).map_err(|e| format!("create logs dir failed: {}", e))?;
    let log_path = log_dir.join("diagnostic.log");
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
        .map_err(|e| format!("open diagnostic log failed: {}", e))?;
    writeln!(file, "{}", line).map_err(|e| format!("write diagnostic log failed: {}", e))
}

fn chrono_like_now_ms() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or_default()
}

#[tauri::command]
pub async fn set_autostart(app: AppHandle, enabled: bool) -> Result<(), String> {
    use tauri_plugin_autostart::ManagerExt;
    let autostart = app.autolaunch();
    if enabled {
        autostart.enable().map_err(|e| format!("Falha ao ativar auto-launch: {}", e))?;
    } else {
        autostart.disable().map_err(|e| format!("Falha ao desativar auto-launch: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
pub fn send_notification(app: AppHandle, title: String, body: String) -> Result<(), String> {
    use tauri_plugin_notification::NotificationExt;

    // Write the notification icon to a temp file so the OS can reference it.
    // On macOS, the app bundle icon is used automatically, but we also write
    // a PNG so that if the icon cache is stale the path-based icon can help
    // on Linux/Windows where .icon() accepts a file path.
    let icon_path = get_or_create_notification_icon();

    let mut builder = app.notification()
        .builder()
        .title(&title)
        .body(&body);

    if let Some(path) = icon_path {
        builder = builder.icon(path);
    }

    builder.show()
        .map_err(|e| format!("Falha na notificacao: {}", e))?;
    Ok(())
}

/// Writes the embedded horse icon to a file in the temp directory once,
/// then returns the path on subsequent calls.
fn get_or_create_notification_icon() -> Option<String> {
    let icon_bytes = include_bytes!("../icons/notification.png");
    let path = std::env::temp_dir().join("hat-notification-icon.png");

    if !path.exists() {
        if std::fs::write(&path, icon_bytes).is_err() {
            return None;
        }
    }

    Some(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn open_main_window(app: AppHandle) {
    windows::show_window(&app, "main");
}

#[tauri::command]
pub fn toggle_popover_window(app: AppHandle) {
    if windows::is_window_visible(&app, "popover") {
        windows::hide_window(&app, "popover");
    } else {
        windows::show_window(&app, "popover");
    }
}

#[tauri::command]
pub fn close_window(app: AppHandle, label: String) {
    windows::hide_window(&app, &label);
}

#[tauri::command]
pub fn quit_app(app: AppHandle) {
    app.exit(0);
}

/// Pre-creates the flash window hidden on app startup so the webview is ready
/// to receive `chat-stream` chunks in typewriter mode (which needs the listener
/// mounted before the stream begins). Safe to call repeatedly.
#[tauri::command]
pub fn flash_ensure(app: AppHandle) -> Result<(), String> {
    if let Some(window) = windows::ensure_flash(&app) {
        let _ = window.set_ignore_cursor_events(true);
    }
    Ok(())
}

/// Creates the flash window if missing, moves it to `position`, emits the
/// payload on `flash-show` for the `/flash` route, then reveals the window.
/// The window is created with `visible(false)` + `focused(false)` so this
/// never steals focus from the user's active app.
#[tauri::command]
pub fn flash_show(
    app: AppHandle,
    text: String,
    position: FlashPosition,
    timing: FlashTiming,
    appearance: FlashAppearance,
    stream_id: u64,
) -> Result<(), String> {
    let window = windows::ensure_flash(&app)
        .ok_or_else(|| "Flash window not available".to_string())?;

    eprintln!(
        "[flash] show stream={} pos={}x{} mode={} text_len={}",
        stream_id, position.x, position.y, timing.mode, text.len()
    );

    // Position BEFORE showing so the window never flashes in its default spot.
    let _ = window.set_ignore_cursor_events(true);
    let _ = window.set_position(PhysicalPosition::new(position.x, position.y));

    let payload = FlashShowPayload { text, timing, appearance, stream_id };
    app.emit("flash-show", payload)
        .map_err(|e| format!("flash-show emit failed: {}", e))?;

    window.show().map_err(|e| format!("flash show failed: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn flash_hide(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("flash") {
        let _ = window.hide();
    }
    Ok(())
}

/// Puts the flash window into adjust mode: creates it if needed, moves to the
/// current saved position, disables click-through so the user can drag, and
/// tells the frontend to render drag chrome + Save/Cancel buttons.
#[tauri::command]
pub fn flash_enter_adjust_mode(app: AppHandle, position: FlashPosition) -> Result<(), String> {
    let window = windows::ensure_flash(&app)
        .ok_or_else(|| "Flash window not available".to_string())?;

    let _ = window.set_ignore_cursor_events(false);
    let _ = window.set_position(PhysicalPosition::new(position.x, position.y));

    app.emit("flash-adjust-enter", ())
        .map_err(|e| format!("flash-adjust-enter emit failed: {}", e))?;
    window.show().map_err(|e| format!("flash show failed: {}", e))?;
    // Deliberately NOT calling set_focus(): doing so activates the Hat app on
    // macOS, which steals the user's foreground context. The window is still
    // draggable + clickable thanks to accept_first_mouse=true.
    Ok(())
}

#[tauri::command]
pub fn flash_exit_adjust_mode(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("flash") {
        let _ = window.set_ignore_cursor_events(true);
        let _ = window.hide();
    }
    // On macOS, hiding our window surfaces whichever Hat window was next in
    // the z-order (main/popover), pulling the user out of their workflow.
    // Asking the app to step back into the background restores whichever
    // external app was frontmost before adjust mode started.
    #[cfg(target_os = "macos")]
    {
        let _ = app.hide();
    }
    Ok(())
}
