use tauri::AppHandle;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

use crate::windows;

pub fn register_default_shortcuts(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let app_handle = app.clone();

    app.global_shortcut().on_shortcuts(
        [
            // Cmd/Ctrl+Shift+Z → open analysis window
            Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::KeyZ),
            // Cmd/Ctrl+Shift+X → process clipboard
            Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::KeyX),
        ],
        move |_app, shortcut, event| {
            if event.state == ShortcutState::Pressed {
                if shortcut.matches(Modifiers::SUPER | Modifiers::SHIFT, Code::KeyZ) {
                    // Open analysis window
                    windows::show_window(&app_handle, "analysis");
                } else if shortcut.matches(Modifiers::SUPER | Modifiers::SHIFT, Code::KeyX) {
                    // Emit clipboard processing event to frontend
                    use tauri::Emitter;
                    let _ = app_handle.emit("process-clipboard", ());
                }
            }
        },
    )?;

    Ok(())
}
