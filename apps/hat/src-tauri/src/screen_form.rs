use std::{fs, process::Command, time::{SystemTime, UNIX_EPOCH}};

use base64::{engine::general_purpose::STANDARD, Engine};
use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScreenCapture {
    pub base64_png: String,
    pub logical_width: u32,
    pub logical_height: u32,
    pub scale_factor: f64,
}

#[tauri::command]
pub fn capture_screen() -> Result<ScreenCapture, String> {
    let monitors = xcap::Monitor::all().map_err(|e| format!("Falha ao listar telas: {e}"))?;
    let monitor = monitors.into_iter()
        .find(|m| m.is_primary().unwrap_or(false))
        .ok_or_else(|| "Monitor principal não encontrado.".to_string())?;
    let image = monitor.capture_image()
        .map_err(|e| format!("Falha ao capturar tela. Verifique a permissão de gravação de tela: {e}"))?;
    let stamp = SystemTime::now().duration_since(UNIX_EPOCH).map_err(|e| e.to_string())?.as_nanos();
    let path = std::env::temp_dir().join(format!("hat-beta-screen-{stamp}.png"));
    image.save(&path).map_err(|e| format!("Falha ao codificar captura: {e}"))?;
    let bytes = fs::read(&path).map_err(|e| e.to_string())?;
    let _ = fs::remove_file(&path);
    let scale = monitor.scale_factor().map_err(|e| e.to_string())? as f64;
    let width = monitor.width().map_err(|e| e.to_string())?;
    let height = monitor.height().map_err(|e| e.to_string())?;
    Ok(ScreenCapture {
        base64_png: STANDARD.encode(bytes),
        logical_width: ((width as f64) / scale).round() as u32,
        logical_height: ((height as f64) / scale).round() as u32,
        scale_factor: scale,
    })
}

#[tauri::command]
pub fn paste_screen_text(x: f64, y: f64, text: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        crate::clipboard::write_clipboard(text)?;
        click_screen(x, y)?;
        std::thread::sleep(std::time::Duration::from_millis(80));
        let script = "tell application \"System Events\" to keystroke \"v\" using command down";
        let out = Command::new("/usr/bin/osascript").args(["-e", script]).output()
            .map_err(|e| format!("Falha ao colar resposta: {e}"))?;
        if !out.status.success() { return Err("Permissão de Acessibilidade necessária.".into()); }
        return Ok(());
    }
    #[cfg(not(target_os = "macos"))]
    Err("Screen Solve beta ainda está disponível apenas no macOS.".into())
}

#[tauri::command]
pub fn click_screen(x: f64, y: f64) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let script = format!("tell application \"System Events\" to click at {{{}, {}}}", x.round(), y.round());
        let out = Command::new("/usr/bin/osascript").args(["-e", &script]).output()
            .map_err(|e| format!("Falha ao executar clique: {e}"))?;
        if !out.status.success() {
            return Err(format!("Permissão de Acessibilidade necessária: {}", String::from_utf8_lossy(&out.stderr)));
        }
        return Ok(());
    }
    #[cfg(not(target_os = "macos"))]
    Err("Screen Solve beta ainda está disponível apenas no macOS.".into())
}
