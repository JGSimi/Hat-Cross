use std::collections::HashMap;
use std::sync::Mutex;
use once_cell::sync::Lazy;
use tauri::AppHandle;

use crate::windows;

static API_KEYS: Lazy<Mutex<HashMap<String, String>>> = Lazy::new(|| Mutex::new(HashMap::new()));

#[tauri::command]
pub fn set_provider_key(provider: String, key: String) {
    let mut keys = API_KEYS.lock().unwrap();
    if key.is_empty() {
        keys.remove(&provider);
    } else {
        keys.insert(provider, key);
    }
}

pub fn get_provider_key(provider: &str) -> String {
    let keys = API_KEYS.lock().unwrap();
    keys.get(provider).cloned().unwrap_or_default()
}

#[tauri::command]
pub fn get_provider_key_cmd(provider: String) -> String {
    get_provider_key(&provider)
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
pub fn close_window(app: AppHandle, label: String) {
    windows::hide_window(&app, &label);
}

#[tauri::command]
pub fn capture_screen(app: AppHandle) -> Result<String, String> {
    capture_screen_impl(&app)
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
