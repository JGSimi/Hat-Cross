use std::{
    ffi::c_void,
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
mod macos_input {
    use super::c_void;

    #[repr(C)]
    #[derive(Clone, Copy)]
    struct CGPoint {
        x: f64,
        y: f64,
    }

    type CGEventRef = *mut c_void;

    const HID_EVENT_TAP: u32 = 0;
    const LEFT_MOUSE_DOWN: u32 = 1;
    const LEFT_MOUSE_UP: u32 = 2;
    const LEFT_MOUSE_BUTTON: u32 = 0;
    const KEY_V: u16 = 9;
    const FLAG_COMMAND: u64 = 1 << 20;

    #[link(name = "CoreGraphics", kind = "framework")]
    extern "C" {
        fn CGPreflightPostEventAccess() -> bool;
        fn CGRequestPostEventAccess() -> bool;
        fn CGEventCreateMouseEvent(
            source: *mut c_void,
            mouse_type: u32,
            mouse_cursor_position: CGPoint,
            mouse_button: u32,
        ) -> CGEventRef;
        fn CGEventCreateKeyboardEvent(
            source: *mut c_void,
            virtual_key: u16,
            key_down: bool,
        ) -> CGEventRef;
        fn CGEventSetFlags(event: CGEventRef, flags: u64);
        fn CGEventPost(tap: u32, event: CGEventRef);
    }

    #[link(name = "CoreFoundation", kind = "framework")]
    extern "C" {
        fn CFRelease(value: *const c_void);
    }

    fn trusted() -> bool {
        unsafe { CGPreflightPostEventAccess() }
    }

    pub fn request_accessibility() -> bool {
        if trusted() {
            return true;
        }
        unsafe {
            let _ = CGRequestPostEventAccess();
        }
        false
    }

    fn ensure_accessibility() -> Result<(), String> {
        if trusted() {
            Ok(())
        } else {
            unsafe {
                let _ = CGRequestPostEventAccess();
            }
            Err("Permissão de Acessibilidade necessária.".into())
        }
    }

    unsafe fn post_and_release(event: CGEventRef) -> Result<(), String> {
        if event.is_null() {
            return Err("Falha ao criar evento nativo do macOS.".into());
        }
        unsafe {
            CGEventPost(HID_EVENT_TAP, event);
            CFRelease(event.cast_const());
        }
        Ok(())
    }

    pub fn click(x: f64, y: f64) -> Result<(), String> {
        ensure_accessibility()?;
        let point = CGPoint { x, y };
        unsafe {
            let down = CGEventCreateMouseEvent(
                std::ptr::null_mut(),
                LEFT_MOUSE_DOWN,
                point,
                LEFT_MOUSE_BUTTON,
            );
            post_and_release(down)?;
            let up = CGEventCreateMouseEvent(
                std::ptr::null_mut(),
                LEFT_MOUSE_UP,
                point,
                LEFT_MOUSE_BUTTON,
            );
            post_and_release(up)?;
        }
        Ok(())
    }

    pub fn paste_command() -> Result<(), String> {
        ensure_accessibility()?;
        unsafe {
            let down = CGEventCreateKeyboardEvent(std::ptr::null_mut(), KEY_V, true);
            if down.is_null() {
                return Err("Falha ao criar Cmd+V nativo.".into());
            }
            CGEventSetFlags(down, FLAG_COMMAND);
            post_and_release(down)?;

            let up = CGEventCreateKeyboardEvent(std::ptr::null_mut(), KEY_V, false);
            if up.is_null() {
                return Err("Falha ao criar Cmd+V nativo.".into());
            }
            CGEventSetFlags(up, FLAG_COMMAND);
            post_and_release(up)?;
        }
        Ok(())
    }
}

#[tauri::command]
pub fn request_accessibility() -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        return Ok(macos_input::request_accessibility());
    }
    #[cfg(not(target_os = "macos"))]
    {
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
pub fn paste_screen_text(x: f64, y: f64, text: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        crate::clipboard::write_clipboard(text)?;
        macos_input::click(x, y)?;
        std::thread::sleep(std::time::Duration::from_millis(80));
        return macos_input::paste_command();
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (x, y, text);
        Err("Screen Solve beta ainda está disponível apenas no macOS.".into())
    }
}

#[tauri::command]
pub fn click_screen(x: f64, y: f64) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        return macos_input::click(x, y);
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (x, y);
        Err("Screen Solve beta ainda está disponível apenas no macOS.".into())
    }
}
