//! Leitura de clipboard atrás do trait `ClipboardPort` — isola o crate
//! comunitário `clipboard-rs` (troca por arboard = mudança de um arquivo,
//! decisão do ADR-001). Leitura SOMENTE em gesto do usuário (atalho/comando);
//! nunca polling em background (Pasteboard Privacy, macOS 15.4+).

use base64::Engine;
use clipboard_rs::common::RustImage;
use clipboard_rs::{Clipboard, ClipboardContext};
use serde::Serialize;

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ClipboardContent {
    Text { text: String },
    Image { base64_png: String },
    Empty,
}

pub trait ClipboardPort: Send + Sync {
    fn read(&self) -> ClipboardContent;
}

pub struct SystemClipboard;

impl ClipboardPort for SystemClipboard {
    fn read(&self) -> ClipboardContent {
        // Texto primeiro (rápido); fallback para imagem. No Windows, retry
        // 3×60 ms: o atalho global dispara microssegundos após Ctrl+C e pode
        // perder a corrida de ownership do clipboard (lição do legado).
        for attempt in 0..3 {
            if let Some(content) = try_read() {
                return content;
            }
            if !cfg!(target_os = "windows") {
                break;
            }
            if attempt < 2 {
                std::thread::sleep(std::time::Duration::from_millis(60));
            }
        }
        ClipboardContent::Empty
    }
}

fn try_read() -> Option<ClipboardContent> {
    let ctx = ClipboardContext::new().ok()?;
    if let Ok(text) = ctx.get_text() {
        let trimmed = text.trim();
        if !trimmed.is_empty() {
            return Some(ClipboardContent::Text { text });
        }
    }
    if let Ok(image) = ctx.get_image() {
        // clipboard-rs devolve PNG encodado — payload pequeno no IPC
        // (o plugin oficial devolve RGBA cru; ver ADR-001).
        if let Ok(png) = image.to_png() {
            let b64 = base64::engine::general_purpose::STANDARD.encode(png.get_bytes());
            return Some(ClipboardContent::Image { base64_png: b64 });
        }
    }
    None
}

#[tauri::command]
pub fn read_clipboard() -> ClipboardContent {
    SystemClipboard.read()
}

/// Escreve texto no clipboard do sistema. Usado para colocar a resposta da IA
/// no clipboard ao fim do stream, para o usuário colar se quiser.
#[tauri::command]
pub fn write_clipboard(text: String) -> Result<(), String> {
    let ctx = ClipboardContext::new().map_err(|e| e.to_string())?;
    ctx.set_text(text).map_err(|e| e.to_string())
}
