//! Tray/menubar. Ícone via TrayIconBuilder (NÃO via tauri.conf.json —
//! tauri#11931) e menu raiz plano (tauri#11363).

use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager};

pub fn create(app: &AppHandle) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Abrir Hat", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Sair do Hat", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &quit])?;

    TrayIconBuilder::with_id("hat-tray")
        .icon(
            app.default_window_icon()
                .expect("ícone padrão ausente do bundle")
                .clone(),
        )
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .build(app)?;
    Ok(())
}
