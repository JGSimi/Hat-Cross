use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

pub fn show_window(app: &AppHandle, label: &str) {
    if let Some(window) = app.get_webview_window(label) {
        let _ = window.show();
        let _ = window.set_focus();
    } else {
        let url = match label {
            "popover" => "/popover",
            "main" => "/main",
            "analysis" => "/analysis",
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
                .skip_taskbar(true)
                .always_on_top(true),
            "main" => builder
                .title("Hat")
                .inner_size(820.0, 650.0)
                .min_inner_size(600.0, 500.0)
                .decorations(false),
            "analysis" => builder
                .title("Hat - Analise de Tela")
                .inner_size(1000.0, 700.0)
                .decorations(false),
            _ => builder
                .title("Hat")
                .inner_size(820.0, 650.0)
                .decorations(false),
        };

        match builder.build() {
            Ok(window) => {
                let _ = window.show();
                let _ = window.set_focus();
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
