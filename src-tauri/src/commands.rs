use serde::Serialize;
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
pub async fn open_analysis_window(app: AppHandle) -> Result<(), String> {
    windows::show_window(&app, "analysis");
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

#[tauri::command]
pub fn capture_screen(app: AppHandle) -> Result<String, String> {
    capture_screen_impl(&app)
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

#[cfg(target_os = "macos")]
fn capture_screen_impl(_app: &AppHandle) -> Result<String, String> {
    use std::fs;
    use std::path::PathBuf;

    let temp_dir = std::env::temp_dir();
    let file_name = format!("hat_capture_{}.png", uuid::Uuid::new_v4());
    let path: PathBuf = temp_dir.join(&file_name);
    let path_str = path.to_string_lossy().to_string();

    let output = std::process::Command::new("screencapture")
        .args(["-x", "-t", "png", &path_str])
        .output()
        .map_err(|e| format!("Erro ao capturar tela: {}", e))?;

    if !output.status.success() {
        return Err(format!("screencapture falhou: {}", String::from_utf8_lossy(&output.stderr)));
    }

    let data = fs::read(&path).map_err(|e| format!("Erro ao ler captura: {}", e))?;
    let _ = fs::remove_file(&path);

    use base64::Engine;
    Ok(base64::engine::general_purpose::STANDARD.encode(&data))
}

#[cfg(target_os = "windows")]
fn capture_screen_impl(_app: &AppHandle) -> Result<String, String> {
    use std::io::Cursor;

    let monitors = xcap::Monitor::all().map_err(|e| format!("Erro ao listar monitores: {}", e))?;
    let primary = monitors.into_iter().find(|m| m.is_primary().unwrap_or(false))
        .ok_or_else(|| "Nenhum monitor principal encontrado.".to_string())?;

    let image = primary.capture_image().map_err(|e| format!("Erro ao capturar tela: {}", e))?;

    let mut buf = Cursor::new(Vec::new());
    image.write_to(&mut buf, image::ImageFormat::Png)
        .map_err(|e| format!("Erro ao codificar imagem: {}", e))?;

    use base64::Engine;
    Ok(base64::engine::general_purpose::STANDARD.encode(buf.into_inner()))
}

#[cfg(target_os = "linux")]
fn capture_screen_impl(_app: &AppHandle) -> Result<String, String> {
    use std::fs;
    use std::path::PathBuf;

    let temp_dir = std::env::temp_dir();
    let file_name = format!("hat_capture_{}.png", uuid::Uuid::new_v4());
    let path: PathBuf = temp_dir.join(&file_name);
    let path_str = path.to_string_lossy().to_string();

    let output = std::process::Command::new("gnome-screenshot")
        .args(["-f", &path_str])
        .output()
        .or_else(|_| std::process::Command::new("scrot").args([&path_str]).output())
        .map_err(|e| format!("Erro ao capturar tela: {}", e))?;

    if !output.status.success() {
        return Err("Nenhuma ferramenta de captura encontrada.".to_string());
    }

    let data = fs::read(&path).map_err(|e| format!("Erro ao ler captura: {}", e))?;
    let _ = fs::remove_file(&path);

    use base64::Engine;
    Ok(base64::engine::general_purpose::STANDARD.encode(&data))
}
