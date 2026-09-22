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

    use tauri::AppHandle;

    const HELPER_BYTES: &[u8] = include_bytes!("../resources/hat-input-helper");
    const HELPER_APP_NAME: &str = "Hat Input Helper.app";
    const HELPER_EXECUTABLE: &str = "Hat Input Helper";
    const HELPER_BUNDLE_ID: &str = "com.hatcross.inputhelper";
    const HELPER_VERSION: &str = "1.0.0";

    fn helper_bundle() -> Result<PathBuf, String> {
        let home = std::env::var_os("HOME")
            .ok_or_else(|| "HOME indisponível para o helper.".to_string())?;
        Ok(PathBuf::from(home).join("Applications").join(HELPER_APP_NAME))
    }

    fn helper_path() -> Result<PathBuf, String> {
        Ok(helper_bundle()?
            .join("Contents")
            .join("MacOS")
            .join(HELPER_EXECUTABLE))
    }

    fn helper_plist() -> Result<PathBuf, String> {
        Ok(helper_bundle()?.join("Contents").join("Info.plist"))
    }

    fn socket_path() -> Result<PathBuf, String> {
        let home = std::env::var_os("HOME")
            .ok_or_else(|| "HOME indisponível para o helper.".to_string())?;
        let uid = fs::metadata(home)
            .map_err(|e| format!("Falha ao identificar usuário: {e}"))?
            .uid();
        Ok(std::env::temp_dir().join(format!("hat-input-helper-app-v1-{uid}.sock")))
    }

    fn info_plist() -> String {
        format!(
            r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key>
  <string>Hat Input Helper</string>
  <key>CFBundleDisplayName</key>
  <string>Hat Input Helper</string>
  <key>CFBundleIdentifier</key>
  <string>{HELPER_BUNDLE_ID}</string>
  <key>CFBundleExecutable</key>
  <string>{HELPER_EXECUTABLE}</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>{HELPER_VERSION}</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>LSUIElement</key>
  <true/>
</dict>
</plist>
"#
        )
    }

    fn install_once(_app: &AppHandle) -> Result<PathBuf, String> {
        let bundle = helper_bundle()?;
        let path = helper_path()?;
        let plist = helper_plist()?;
        let contents = bundle.join("Contents");
        let macos = contents.join("MacOS");

        fs::create_dir_all(&macos)
            .map_err(|e| format!("Falha ao criar Hat Input Helper.app: {e}"))?;

        // Nunca substituímos o executável depois da primeira instalação.
        // O binário congelado mantém o mesmo cdhash entre todas as versões Beta.
        if !path.exists() {
            let temp = macos.join(".hat-input-helper.installing");
            fs::write(&temp, HELPER_BYTES)
                .map_err(|e| format!("Falha ao instalar Hat Input Helper: {e}"))?;
            fs::set_permissions(&temp, fs::Permissions::from_mode(0o700))
                .map_err(|e| format!("Falha ao preparar Hat Input Helper: {e}"))?;
            fs::rename(&temp, &path)
                .map_err(|e| format!("Falha ao ativar Hat Input Helper: {e}"))?;
        }

        // O Info.plist só serve para o macOS/Finder reconhecer o helper como app.
        // Ele não altera nem re-assina o executável congelado.
        if !plist.exists() {
            fs::write(&plist, info_plist())
                .map_err(|e| format!("Falha ao criar Info.plist do helper: {e}"))?;
        }

        Ok(path)
    }

    fn reveal_helper() {
        if let Ok(bundle) = helper_bundle() {
            let _ = Command::new("/usr/bin/open")
                .arg("-R")
                .arg(bundle)
                .stdin(Stdio::null())
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .spawn();
        }
    }

    fn open_accessibility_settings() {
        let _ = Command::new("/usr/bin/open")
            .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility")
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn();
    }

    fn guide_to_accessibility() {
        reveal_helper();
        open_accessibility_settings();
    }

    fn connect_and_send(socket: &Path, command: &str) -> Result<String, String> {
        let mut stream = UnixStream::connect(socket)
            .map_err(|e| format!("Hat Input Helper indisponível: {e}"))?;
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
        let _ = fs::remove_file(&socket);

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

        guide_to_accessibility();
        Ok(false)
    }

    pub fn click(app: &AppHandle, x: f64, y: f64) -> Result<(), String> {
        if command(app, &format!("CLICK {x:.3} {y:.3}"))? == "OK" {
            return Ok(());
        }

        guide_to_accessibility();
        Err("Autorize Hat Input Helper em Ajustes > Privacidade e Segurança > Acessibilidade.".into())
    }

    pub fn paste(app: &AppHandle) -> Result<(), String> {
        if command(app, "PASTE")? == "OK" {
            return Ok(());
        }

        guide_to_accessibility();
        Err("Autorize Hat Input Helper em Ajustes > Privacidade e Segurança > Acessibilidade.".into())
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
