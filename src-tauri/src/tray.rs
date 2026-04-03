use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconEvent,
    Emitter,
};

use crate::windows;

pub fn setup_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let nova_conversa = MenuItem::with_id(app, "nova_conversa", "Nova Conversa", true, None::<&str>)?;
    let janela_principal = MenuItem::with_id(app, "janela_principal", "Janela Principal", true, None::<&str>)?;
    let configuracoes = MenuItem::with_id(app, "configuracoes", "Configurações", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let verificar_updates = MenuItem::with_id(app, "verificar_updates", "Verificar Updates", true, None::<&str>)?;
    let sair = MenuItem::with_id(app, "sair", "Sair", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[
            &nova_conversa,
            &janela_principal,
            &configuracoes,
            &separator,
            &verificar_updates,
            &sair,
        ],
    )?;

    let tray = app.tray_by_id("main").unwrap_or_else(|| {
        tauri::tray::TrayIconBuilder::with_id("main")
            .tooltip("Hat — AI Assistant")
            .icon_as_template(true)
            .icon(app.default_window_icon().unwrap().clone())
            .build(app)
            .expect("failed to build tray icon")
    });

    tray.set_menu(Some(menu))?;

    // Left click: toggle main window
    let app_handle = app.handle().clone();
    tray.on_tray_icon_event(move |_tray, event| {
        if let TrayIconEvent::Click {
            button: tauri::tray::MouseButton::Left,
            ..
        } = event
        {
            if windows::is_window_visible(&app_handle, "main") {
                windows::hide_window(&app_handle, "main");
            } else {
                windows::show_window(&app_handle, "main");
            }
        }
    });

    // Menu item clicks
    let app_handle = app.handle().clone();
    tray.on_menu_event(move |_app, event| {
        let id = event.id().as_ref();
        match id {
            "nova_conversa" => {
                windows::show_window(&app_handle, "main");
                let _ = app_handle.emit("new-conversation", ());
            }
            "janela_principal" => {
                windows::show_window(&app_handle, "main");
            }
            "configuracoes" => {
                windows::show_window(&app_handle, "main");
                let _ = app_handle.emit("open-settings", ());
            }
            "verificar_updates" => {
                let _ = app_handle.emit("check-updates", ());
            }
            "sair" => {
                app_handle.exit(0);
            }
            _ => {}
        }
    });

    Ok(())
}
