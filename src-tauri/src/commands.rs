use serde::Serialize;
use serde_json::{json, Map, Value};
use std::fs::OpenOptions;
use std::io::Write;
use std::path::{Path, PathBuf};
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
    append_diagnostic_line_to_dir(&app_data_dir, line)
}

fn append_diagnostic_line_to_dir(app_data_dir: &Path, line: &str) -> Result<(), String> {
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

fn is_safe_windows_store_file(file: &str) -> bool {
    !file.is_empty()
        && file
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_'))
}

fn windows_store_path(app: &AppHandle, file: &str) -> Result<PathBuf, String> {
    if !is_safe_windows_store_file(file) {
        return Err("invalid store filename".to_string());
    }
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir failed: {}", e))?;
    std::fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("create store dir failed: {}", e))?;
    Ok(app_data_dir.join(file))
}

fn read_windows_store(path: &std::path::Path) -> Result<Map<String, Value>, String> {
    if !path.exists() {
        return Ok(Map::new());
    }
    let raw = std::fs::read_to_string(path).map_err(|e| format!("read store failed: {}", e))?;
    if raw.trim().is_empty() {
        return Ok(Map::new());
    }
    let value: Value =
        serde_json::from_str(&raw).map_err(|e| format!("parse store failed: {}", e))?;
    Ok(value.as_object().cloned().unwrap_or_default())
}

#[tauri::command]
pub fn windows_store_get(
    app: AppHandle,
    file: String,
    key: String,
) -> Result<Option<Value>, String> {
    let path = windows_store_path(&app, &file)?;
    let store = read_windows_store(&path)?;
    Ok(store.get(&key).cloned())
}

#[tauri::command]
pub fn windows_store_set(
    app: AppHandle,
    file: String,
    key: String,
    value: Value,
) -> Result<(), String> {
    let path = windows_store_path(&app, &file)?;
    let mut store = read_windows_store(&path)?;
    store.insert(key, value);
    let raw = serde_json::to_string_pretty(&Value::Object(store))
        .map_err(|e| format!("serialize store failed: {}", e))?;
    std::fs::write(path, raw).map_err(|e| format!("write store failed: {}", e))
}

#[cfg(test)]
mod command_tests {
    use super::{
        append_diagnostic_line_to_dir, is_safe_windows_store_file, read_windows_store,
    };
    use serde_json::json;
    use std::fs;

    fn temp_test_dir(name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "hat-cross-commands-test-{}-{}",
            name,
            std::process::id(),
        ));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("test dir should be created");
        dir
    }

    #[test]
    fn validates_windows_store_filename_before_joining_app_data() {
        assert!(is_safe_windows_store_file("settings.json"));
        assert!(is_safe_windows_store_file("conversation-state.json"));
        assert!(is_safe_windows_store_file("drafts_data-1.json"));

        assert!(!is_safe_windows_store_file(""));
        assert!(!is_safe_windows_store_file("../settings.json"));
        assert!(!is_safe_windows_store_file("nested/settings.json"));
        assert!(!is_safe_windows_store_file("settings json"));
    }

    #[test]
    fn reads_windows_store_json_objects_and_missing_files_as_empty() {
        let dir = temp_test_dir("read-store");
        let missing = dir.join("missing.json");
        assert!(read_windows_store(&missing).expect("missing file should be empty").is_empty());

        let store = dir.join("settings.json");
        fs::write(&store, r#"{"hat-settings":{"settings":{"language":"en-US"}}}"#)
            .expect("store fixture should write");
        let parsed = read_windows_store(&store).expect("store should parse");

        assert_eq!(
            parsed.get("hat-settings"),
            Some(&json!({ "settings": { "language": "en-US" } })),
        );

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn appends_diagnostic_lines_to_persistent_log_file() {
        let dir = temp_test_dir("diagnostic-log");

        append_diagnostic_line_to_dir(&dir, r#"{"event":"boot_start"}"#)
            .expect("first line should write");
        append_diagnostic_line_to_dir(&dir, r#"{"event":"boot_ok"}"#)
            .expect("second line should append");

        let log = fs::read_to_string(dir.join("logs").join("diagnostic.log"))
            .expect("diagnostic log should exist");
        assert!(log.contains(r#"{"event":"boot_start"}"#));
        assert!(log.contains(r#"{"event":"boot_ok"}"#));

        let _ = fs::remove_dir_all(dir);
    }
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

/// Lazily creates the flash window hidden so callers can wait for the webview
/// listener handshake before sending `flash-show`. Safe to call repeatedly.
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
