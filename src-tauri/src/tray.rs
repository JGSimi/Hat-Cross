use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::TrayIconEvent,
    AppHandle, Emitter,
};

use crate::windows;

// --- Types for dynamic tray menu ---

#[derive(serde::Deserialize, Clone)]
pub struct RecentConversation {
    pub id: String,
    pub title: String,
}

#[derive(serde::Deserialize)]
pub struct TrayState {
    pub provider_label: String,
    pub is_processing: bool,
    pub recent_conversations: Vec<RecentConversation>,
}

// --- Build menu from state ---

fn build_tray_menu(app: &AppHandle, state: Option<&TrayState>) -> Result<Menu<tauri::Wry>, Box<dyn std::error::Error>> {
    let menu = Menu::new(app)?;

    // Provider/model header (dynamic)
    if let Some(s) = state {
        let provider_item = MenuItem::with_id(app, "provider_label", &s.provider_label, false, None::<&str>)?;
        menu.append(&provider_item)?;

        if s.is_processing {
            let processing_item = MenuItem::with_id(app, "processing", "⏳ Processando...", false, None::<&str>)?;
            menu.append(&processing_item)?;
        }

        menu.append(&PredefinedMenuItem::separator(app)?)?;
    }

    // New conversation
    let nova_conversa = MenuItem::with_id(app, "nova_conversa", "Nova Conversa", true, None::<&str>)?;
    menu.append(&nova_conversa)?;

    menu.append(&PredefinedMenuItem::separator(app)?)?;

    // Quick actions
    let processar_clipboard = MenuItem::with_id(app, "processar_clipboard", "Processar Clipboard", true, None::<&str>)?;
    let captura_tela = MenuItem::with_id(app, "captura_tela", "Captura de Tela", true, None::<&str>)?;
    menu.append(&processar_clipboard)?;
    menu.append(&captura_tela)?;

    menu.append(&PredefinedMenuItem::separator(app)?)?;

    // Recent conversations submenu (dynamic)
    if let Some(s) = state {
        if !s.recent_conversations.is_empty() {
            let submenu = Submenu::new(app, "Conversas Recentes", true)?;
            for conv in s.recent_conversations.iter().take(5) {
                let title = if conv.title.len() > 35 {
                    format!("{}...", &conv.title[..32])
                } else {
                    conv.title.clone()
                };
                let item_id = format!("conv_{}", conv.id);
                let item = MenuItem::with_id(app, &item_id, &title, true, None::<&str>)?;
                submenu.append(&item)?;
            }
            menu.append(&submenu)?;
            menu.append(&PredefinedMenuItem::separator(app)?)?;
        }
    }

    // Window & settings
    let janela_principal = MenuItem::with_id(app, "janela_principal", "Janela Principal", true, None::<&str>)?;
    let configuracoes = MenuItem::with_id(app, "configuracoes", "Configurações", true, None::<&str>)?;
    menu.append(&janela_principal)?;
    menu.append(&configuracoes)?;

    menu.append(&PredefinedMenuItem::separator(app)?)?;

    // Updates & exit
    let verificar_updates = MenuItem::with_id(app, "verificar_updates", "Verificar Updates", true, None::<&str>)?;
    let sair = MenuItem::with_id(app, "sair", "Sair", true, None::<&str>)?;
    menu.append(&verificar_updates)?;
    menu.append(&sair)?;

    Ok(menu)
}

// --- Handle menu events ---

fn handle_menu_event(app_handle: &AppHandle, id: &str) {
    match id {
        "nova_conversa" => {
            windows::show_window(app_handle, "main");
            let _ = app_handle.emit("new-conversation", ());
        }
        "processar_clipboard" => {
            let _ = app_handle.emit("process-clipboard", ());
        }
        "captura_tela" => {
            windows::show_window(app_handle, "analysis");
        }
        "janela_principal" => {
            windows::show_window(app_handle, "main");
        }
        "configuracoes" => {
            windows::show_window(app_handle, "main");
            let _ = app_handle.emit("open-settings", ());
        }
        "verificar_updates" => {
            let _ = app_handle.emit("check-updates", ());
        }
        "sair" => {
            app_handle.exit(0);
        }
        _ => {
            // Handle recent conversation clicks
            if let Some(conv_id) = id.strip_prefix("conv_") {
                windows::show_window(app_handle, "main");
                let _ = app_handle.emit("load-conversation", conv_id.to_string());
            }
        }
    }
}

// --- Initial setup ---

pub fn setup_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let app_handle = app.handle();
    let menu = build_tray_menu(app_handle, None)?;

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
        handle_menu_event(&app_handle, event.id().as_ref());
    });

    Ok(())
}

// --- Tauri commands ---

#[tauri::command]
pub fn rebuild_tray_menu(app: AppHandle, state: TrayState) -> Result<(), String> {
    let menu = build_tray_menu(&app, Some(&state)).map_err(|e| e.to_string())?;
    let tray = app.tray_by_id("main").ok_or("tray not found")?;
    tray.set_menu(Some(menu)).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn set_tray_icon(app: AppHandle, icon_state: String) -> Result<(), String> {
    let tray = app.tray_by_id("main").ok_or("tray not found")?;
    let png_bytes: &[u8] = match icon_state.as_str() {
        "processing" => include_bytes!("../icons/tray-processing.png"),
        _ => include_bytes!("../icons/tray-idle.png"),
    };
    let img = image::load_from_memory(png_bytes).map_err(|e| e.to_string())?;
    let rgba = img.to_rgba8();
    let (w, h) = rgba.dimensions();
    let icon = tauri::image::Image::new_owned(rgba.into_raw(), w, h);
    tray.set_icon(Some(icon)).map_err(|e| e.to_string())?;
    Ok(())
}
