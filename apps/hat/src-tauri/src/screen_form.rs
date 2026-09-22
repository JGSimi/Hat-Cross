use std::{
    fs,
    time::{SystemTime, UNIX_EPOCH},
};

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

#[cfg(target_os = "macos")]
mod macos_helper {
    use std::{
        fs,
        io::{Read, Write},
        os::unix::{
            fs::{MetadataExt, PermissionsExt},
            net::UnixStream,
        },
        path::{Path, PathBuf},
        process::{Command, Stdio},
        thread,
        time::Duration,
    };

    use tauri::{AppHandle, Manager};

    const HELPER_BYTES: &[u8] = include_bytes!("../resources/hat-input-helper");
    const HELPER_DIR: &str = "input-helper-v1";
    const HELPER_NAME: &str = "Hat Input Helper";

    fn helper_dir(app: &AppHandle) -> Result<PathBuf, String> {
        Ok(app
            .path()
            .app_data_dir()
            .map_err(|e| format!("Falha ao resolver pasta do helper: {e}"))?
            .join(HELPER_DIR))
    }

    fn helper_path(app: &AppHandle) -> Result<PathBuf, String> {
        Ok(helper_dir(app)?.join(HELPER_NAME))
    }

    fn socket_path() -> Result<PathBuf, String> {
        let home = std::env::var_os("HOME")
            .ok_or_else(|| "HOME indisponível para o helper.".to_string())?;
        let uid = fs::metadata(home)
            .map_err(|e| format!("Falha ao identificar usuário: {e}"))?
            .uid();
        Ok(std::env::temp_dir().join(format!("hat-input-helper-{uid}.sock")))
    }

    fn install_once(app: &AppHandle) -> Result<PathBuf, String> {
        let dir = helper_dir(app)?;
        let path = helper_path(app)?;
        fs::create_dir_all(&dir)
            .map_err(|e| format!("Falha ao criar pasta do helper: {e}"))?;

        // Deliberadamente nunca substitui um helper existente. A permissão TCC
        // fica vinculada a este binário imutável, cujo cdhash não muda quando
        // o Hat principal recebe atualização.
        if path.exists() {
            return Ok(path);
        }

        let temp = dir.join(".hat-input-helper.installing");
        fs::write(&temp, HELPER_BYTES)
            .map_err(|e| format!("Falha ao instalar helper: {e}"))?;
        fs::set_permissions(&temp, fs::Permissions::from_mode(0o700))
            .map_err(|e| format!("Falha ao preparar helper: {e}"))?;
        fs::rename(&temp, &path)
            .map_err(|e| format!("Falha ao ativar helper: {e}"))?;
        Ok(path)
    }

    fn open_accessibility_settings() {
        let _ = Command::new("/usr/bin/open")
            .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility")
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn();
    }

    fn connect_and_send(socket: &Path, command: &str) -> Result<String, String> {
        let mut stream = UnixStream::connect(socket)
            .map_err(|e| format!("Helper indisponível: {e}"))?;
        stream
            .set_read_timeout(Some(Duration::from_secs(2)))
            .map_err(|e| e.to_string())?;
        stream
            .set_write_timeout(Some(Duration::from_secs(2)))
            .map_err(|e| e.to_string())?;
        stream
            .write_all(format!("{command}\n").as_bytes())
            .map_err(|e| format!("Falha ao enviar comando ao helper: {e}"))?;

        let mut response = String::new();
        stream
            .read_to_string(&mut response)
            .map_err(|e| format!("Falha ao ler helper: {e}"))?;
        Ok(response.trim().to_string())
    }

    fn ensure_running(app: &AppHandle) -> Result<PathBuf, String> {
        let socket = socket_path()?;

        if UnixStream::connect(&socket).is_ok() {
            return Ok(socket);
        }

        let helper = install_once(app)?;
        Command::new(&helper)
            .arg("--socket")
            .arg(&socket)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| format!("Falha ao iniciar Hat Input Helper: {e}"))?;

        for _ in 0..30 {
            if UnixStream::connect(&socket).is_ok() {
                return Ok(socket);
            }
            thread::sleep(Duration::from_millis(50));
        }

        Err("Hat Input Helper não iniciou a tempo.".into())
    }

    fn command(app: &AppHandle, value: &str) -> Result<String, String> {
        let socket = ensure_running(app)?;
        connect_and_send(&socket, value)
    }

    pub fn request_accessibility(app: &AppHandle) -> Result<bool, String> {
        if command(app, "TRUST")? == "1" {
            return Ok(true);
        }

        let _ = command(app, "PROMPT")?;
        thread::sleep(Duration::from_millis(180));

        if command(app, "TRUST")? == "1" {
            return Ok(true);
        }

        open_accessibility_settings();
        Ok(false)
    }

    pub fn click(app: &AppHandle, x: f64, y: f64) -> Result<(), String> {
        if command(app, &format!("CLICK {x:.3} {y:.3}"))? == "OK" {
            return Ok(());
        }

        open_accessibility_settings();
        Err("Permissão de Acessibilidade necessária para o Hat Input Helper.".into())
    }

    pub fn paste(app: &AppHandle) -> Result<(), String> {
        if command(app, "PASTE")? == "OK" {
            return Ok(());
        }

        open_accessibility_settings();
        Err("Permissão de Acessibilidade necessária para o Hat Input Helper.".into())
    }
}

#[tauri::command]
pub fn request_accessibility(app: tauri::AppHandle) -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        return macos_helper::request_accessibility(&app);
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = app;
        Err("Screen Solve beta ainda está disponível apenas no macOS.".into())
    }
}

#[tauri::command]
pub fn capture_screen() -> Result<ScreenCapture, String> {
    let monitors = xcap::Monitor::all().map_err(|e| format!("Falha ao listar telas: {e}"))?;
    let monitor = monitors
        .into_iter()
        .find(|m| m.is_primary().unwrap_or(false))
        .ok_or_else(|| "Monitor principal não encontrado.".to_string())?;
    let image = monitor.capture_image().map_err(|e| {
        format!(
            "Falha ao capturar tela. Verifique a permissão de gravação de tela: {e}"
        )
    })?;
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_nanos();
    let path = std::env::temp_dir().join(format!("hat-beta-screen-{stamp}.png"));
    image
        .save(&path)
        .map_err(|e| format!("Falha ao codificar captura: {e}"))?;
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
pub fn paste_screen_text(
    app: tauri::AppHandle,
    x: f64,
    y: f64,
    text: String,
) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        crate::clipboard::write_clipboard(text)?;
        macos_helper::click(&app, x, y)?;
        std::thread::sleep(std::time::Duration::from_millis(80));
        return macos_helper::paste(&app);
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app, x, y, text);
        Err("Screen Solve beta ainda está disponível apenas no macOS.".into())
    }
}

#[tauri::command]
pub fn click_screen(app: tauri::AppHandle, x: f64, y: f64) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        return macos_helper::click(&app, x, y);
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app, x, y);
        Err("Screen Solve beta ainda está disponível apenas no macOS.".into())
    }
}
