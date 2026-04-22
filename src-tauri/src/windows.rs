use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

use crate::macos_overlay::{apply_fullscreen_overlay, OverlayLevel};

/// Decide o nível de overlay por label. `popover` fica em Floating pra não
/// agredir o Cmd+Tab; `flash` fica em Top porque existe só por 1-2s e
/// precisa ser visto mesmo sobre um Keynote.
fn overlay_level_for(label: &str) -> Option<OverlayLevel> {
    match label {
        "popover" => Some(OverlayLevel::Floating),
        "flash" => Some(OverlayLevel::Top),
        _ => None,
    }
}

/// Ensures the flash webview exists and is ready to receive events, but
/// never shows it or takes focus. Returns the handle for the caller to
/// position + reveal manually.
pub fn ensure_flash(app: &AppHandle) -> Option<WebviewWindow> {
    if let Some(w) = app.get_webview_window("flash") {
        return Some(w);
    }
    // Build via the shared factory (constructs with visible(false), focused(false))
    show_window(app, "flash");
    app.get_webview_window("flash")
}

pub fn show_window(app: &AppHandle, label: &str) {
    if let Some(window) = app.get_webview_window(label) {
        // Reaplica overlay config toda vez — idempotente. Cobre o caso de
        // o usuário ter ativado fullscreen depois da janela ter sido criada.
        if let Some(level) = overlay_level_for(label) {
            apply_fullscreen_overlay(&window, level);
        }
        // Flash never steals focus — callers (flash_show, flash_enter_adjust_mode)
        // handle showing + positioning explicitly.
        if label != "flash" {
            let _ = window.show();
            let _ = window.set_focus();
        }
    } else {
        let url = match label {
            "popover" => "/popover",
            "main" => "/main",
            "flash" => "/flash",
            _ => "/main",
        };

        let builder = WebviewWindowBuilder::new(app, label, WebviewUrl::App(url.into()));

        let builder = match label {
            "popover" => builder
                .title("Hat")
                .inner_size(380.0, 480.0)
                .min_inner_size(300.0, 350.0)
                .max_inner_size(800.0, 900.0)
                .resizable(true)
                .decorations(false)
                .shadow(false)
                .transparent(true)
                .skip_taskbar(true)
                .always_on_top(true)
                // Defense-in-depth: blocks QuickTime classic, AirPlay, and
                // Windows Graphics Capture. Stealth pillar targets *physical
                // observers*, not screen recorders — macOS 15+ ScreenCaptureKit
                // deliberately ignores this flag (tauri#14200), but we still
                // want the free win on every other capture path.
                // See docs/research/stealth-content-protection.md.
                .content_protected(true),
            "main" => builder
                .title("Hat")
                .inner_size(820.0, 650.0)
                .min_inner_size(600.0, 500.0)
                .decorations(false),
            "flash" => builder
                .title("Hat Flash")
                .inner_size(400.0, 60.0)
                .decorations(false)
                .shadow(false)
                .transparent(true)
                .skip_taskbar(true)
                .always_on_top(true)
                .visible_on_all_workspaces(true)
                .focused(false)
                .visible(false)
                .resizable(false)
                // accept_first_mouse=true lets the user click the Save/Cancel
                // buttons without the OS first routing the click to "activate
                // the app" — prevents a no-op first click when adjusting.
                .accept_first_mouse(true)
                // See popover branch: defense-in-depth content protection. Same
                // macOS 15+ caveat applies; stealth pillar targets physical
                // observers so this is a bonus, not a contract.
                .content_protected(true),
            _ => builder
                .title("Hat")
                .inner_size(820.0, 650.0)
                .decorations(false),
        };

        match builder.build() {
            Ok(window) => {
                // Aplica overlay config IMEDIATAMENTE após build, antes de
                // qualquer show/focus. Isso garante que a janela já nasce
                // com os flags de FullScreenAuxiliary corretos no macOS.
                if let Some(level) = overlay_level_for(label) {
                    apply_fullscreen_overlay(&window, level);
                }
                // Flash window is created hidden and should never steal focus —
                // the flash command below shows it explicitly after positioning.
                if label != "flash" {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            Err(e) => {
                eprintln!("Failed to create window {}: {}", label, e);
            }
        }
    }
}

pub fn hide_window(app: &AppHandle, label: &str) {
    if let Some(window) = app.get_webview_window(label) {
        let _ = window.hide();
    }
}

pub fn is_window_visible(app: &AppHandle, label: &str) -> bool {
    if let Some(window) = app.get_webview_window(label) {
        window.is_visible().unwrap_or(false)
    } else {
        false
    }
}
