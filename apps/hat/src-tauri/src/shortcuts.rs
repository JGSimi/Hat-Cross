//! Atalhos globais — registrados NO LADO RUST (não JS): sobrevivem a teardown
//! da webview e disparam com zero janelas visíveis. O fechamento de
//! emergência é 100% nativo: funciona mesmo com o renderer travado.

use std::str::FromStr;
use std::sync::Mutex;

use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, Wry};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
use tauri_plugin_store::StoreExt;

use crate::clipboard::ClipboardPort;
use crate::{clipboard, flash_window};

const SETTINGS_STORE: &str = "settings.json";
const BINDINGS_KEY: &str = "shortcuts";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Action {
    ProcessClipboardFlash,
    AdjustFlashPosition,
    EmergencyQuit,
    ShowCorrection,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ShortcutBindings {
    pub process_clipboard_flash: String,
    pub adjust_flash_position: String,
    pub emergency_quit: String,
    #[serde(default = "default_show_correction")]
    pub show_correction: String,
}

fn default_show_correction() -> String {
    "CommandOrControl+Shift+D".into()
}

impl Default for ShortcutBindings {
    fn default() -> Self {
        Self {
            process_clipboard_flash: "CommandOrControl+Shift+F".into(),
            adjust_flash_position: "CommandOrControl+Alt+F".into(),
            emergency_quit: "CommandOrControl+Shift+Q".into(),
            show_correction: default_show_correction(),
        }
    }
}

impl ShortcutBindings {
    fn entries(&self) -> [(&str, Action); 4] {
        [
            (
                self.process_clipboard_flash.as_str(),
                Action::ProcessClipboardFlash,
            ),
            (
                self.adjust_flash_position.as_str(),
                Action::AdjustFlashPosition,
            ),
            (self.emergency_quit.as_str(), Action::EmergencyQuit),
            (self.show_correction.as_str(), Action::ShowCorrection),
        ]
    }
}

/// Mapa binding registrado → ação. O handler do plugin consulta aqui.
static REGISTRY: Lazy<Mutex<Vec<(Shortcut, Action)>>> = Lazy::new(|| Mutex::new(Vec::new()));

pub fn plugin() -> tauri::plugin::TauriPlugin<Wry> {
    tauri_plugin_global_shortcut::Builder::new()
        .with_handler(|app, shortcut, event| {
            if event.state() != ShortcutState::Pressed {
                return;
            }
            let action = REGISTRY
                .lock()
                .unwrap()
                .iter()
                .find(|(s, _)| s == shortcut)
                .map(|(_, a)| *a);
            if let Some(action) = action {
                handle_action(app, action);
            }
        })
        .build()
}

fn handle_action(app: &AppHandle, action: Action) {
    match action {
        Action::EmergencyQuit => {
            // Caminho 100% nativo: nenhum round-trip pela webview.
            for (_, window) in app.webview_windows() {
                let _ = window.hide();
            }
            app.exit(0);
        }
        Action::AdjustFlashPosition => {
            let _ = app.emit("flash:adjust-mode", ());
            if let Some(window) = app.get_webview_window(flash_window::FLASH_LABEL) {
                let _ = window.set_ignore_cursor_events(false);
                let _ = window.show();
            }
        }
        Action::ProcessClipboardFlash => {
            // Caminho quente: clipboard + flash "processando" inteiramente no
            // Rust; o renderer da janela main recebe o conteúdo e dispara o
            // stream (auth/token vivem lá).
            let content = clipboard::SystemClipboard.read();
            match &content {
                clipboard::ClipboardContent::Empty => {
                    let _ = app.emit("clipboard:failed", serde_json::json!({"reason": "empty"}));
                }
                _ => {
                    flash_window::show(app, "processing", "");
                    let _ = app.emit("clipboard:captured", &content);
                }
            }
        }
        Action::ShowCorrection => {
            // A próxima correção não-lida vive no store da janela main; ela
            // escolhe e chama flash_show_text. Aqui só sinalizamos.
            let _ = app.emit("shortcut:show-correction", ());
        }
    }
}

fn load_bindings(app: &AppHandle) -> ShortcutBindings {
    app.store(SETTINGS_STORE)
        .ok()
        .and_then(|store| store.get(BINDINGS_KEY))
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}

/// Bindings atuais (para a tela de Ajustes exibir/editar).
#[tauri::command]
pub fn get_shortcuts(app: AppHandle) -> ShortcutBindings {
    load_bindings(&app)
}

/// Registra os bindings das settings (defaults na primeira execução).
/// Conflito de registro NÃO derruba o app: emite evento para a UI exibir.
pub fn register_from_settings(app: &AppHandle) -> tauri::Result<()> {
    apply_bindings(app, &load_bindings(app));
    Ok(())
}

fn apply_bindings(app: &AppHandle, bindings: &ShortcutBindings) {
    let gs = app.global_shortcut();
    {
        let mut registry = REGISTRY.lock().unwrap();
        for (shortcut, _) in registry.drain(..) {
            let _ = gs.unregister(shortcut);
        }
    }
    for (binding, action) in bindings.entries() {
        let Some(normalized) = hat_core::accelerator::normalize(binding) else {
            emit_registration_failure(app, binding, "invalid");
            continue;
        };
        match Shortcut::from_str(&normalized) {
            Ok(shortcut) => match gs.register(shortcut) {
                Ok(()) => REGISTRY.lock().unwrap().push((shortcut, action)),
                Err(_) => emit_registration_failure(app, &normalized, "conflict"),
            },
            Err(_) => emit_registration_failure(app, &normalized, "unparseable"),
        }
    }
}

fn emit_registration_failure(app: &AppHandle, binding: &str, code: &str) {
    let _ = app.emit(
        "shortcut:registration-failed",
        serde_json::json!({ "binding": binding, "code": code }),
    );
}

/// Rebind dinâmico vindo da UI. Persiste e re-registra; em erro de algum
/// binding o evento `shortcut:registration-failed` informa a UI (os demais
/// continuam valendo).
#[tauri::command]
pub fn set_shortcuts(app: AppHandle, bindings: ShortcutBindings) -> Result<(), String> {
    let store = app.store(SETTINGS_STORE).map_err(|e| e.to_string())?;
    store.set(
        BINDINGS_KEY,
        serde_json::to_value(&bindings).map_err(|e| e.to_string())?,
    );
    apply_bindings(&app, &bindings);
    let _ = app.emit("settings:changed", ());
    Ok(())
}
