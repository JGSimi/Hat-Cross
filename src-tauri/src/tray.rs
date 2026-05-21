use std::sync::Mutex;

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconEvent,
    AppHandle, Emitter,
};

use crate::windows;

#[derive(serde::Deserialize)]
pub struct TrayState {
    pub provider_label: String,
    pub is_processing: bool,
}

#[derive(Clone, Copy)]
struct TrayLabels {
    processing: &'static str,
    process_clipboard: &'static str,
    main_window: &'static str,
    settings: &'static str,
    check_updates: &'static str,
    quit: &'static str,
    tooltip: &'static str,
}

const LABELS_PT_BR: TrayLabels = TrayLabels {
    processing: "⏳ Processando...",
    process_clipboard: "Processar Clipboard",
    main_window: "Sala ativa",
    settings: "Configurações",
    check_updates: "Verificar Atualizações",
    quit: "Sair",
    tooltip: "Hat Flash",
};

const LABELS_EN_US: TrayLabels = TrayLabels {
    processing: "⏳ Processing...",
    process_clipboard: "Process Clipboard",
    main_window: "Active room",
    settings: "Settings",
    check_updates: "Check for Updates",
    quit: "Quit",
    tooltip: "Hat Flash",
};

const LABELS_ES_ES: TrayLabels = TrayLabels {
    processing: "⏳ Procesando...",
    process_clipboard: "Procesar Portapapeles",
    main_window: "Sala activa",
    settings: "Ajustes",
    check_updates: "Buscar Actualizaciones",
    quit: "Salir",
    tooltip: "Hat Flash",
};

fn labels_for(lang: &str) -> TrayLabels {
    match lang {
        "en-US" | "en" => LABELS_EN_US,
        "es-ES" | "es" => LABELS_ES_ES,
        _ => LABELS_PT_BR,
    }
}

static TRAY_LANG: Mutex<String> = Mutex::new(String::new());

fn current_labels() -> TrayLabels {
    let guard = TRAY_LANG.lock().ok();
    let lang_str = guard.as_ref().map(|g| g.as_str()).unwrap_or("pt-BR");
    labels_for(lang_str)
}

fn build_tray_menu(app: &AppHandle, state: Option<&TrayState>) -> Result<Menu<tauri::Wry>, Box<dyn std::error::Error>> {
    let menu = Menu::new(app)?;
    let labels = current_labels();

    if let Some(s) = state {
        let provider_item = MenuItem::with_id(app, "provider_label", &s.provider_label, false, None::<&str>)?;
        menu.append(&provider_item)?;

        if s.is_processing {
            let processing_item = MenuItem::with_id(app, "processing", labels.processing, false, None::<&str>)?;
            menu.append(&processing_item)?;
        }

        menu.append(&PredefinedMenuItem::separator(app)?)?;
    }

    let processar_clipboard = MenuItem::with_id(app, "processar_clipboard", labels.process_clipboard, true, None::<&str>)?;
    let janela_principal = MenuItem::with_id(app, "janela_principal", labels.main_window, true, None::<&str>)?;
    let configuracoes = MenuItem::with_id(app, "configuracoes", labels.settings, true, None::<&str>)?;
    menu.append(&processar_clipboard)?;
    menu.append(&janela_principal)?;
    menu.append(&configuracoes)?;

    menu.append(&PredefinedMenuItem::separator(app)?)?;

    let verificar_updates = MenuItem::with_id(app, "verificar_updates", labels.check_updates, true, None::<&str>)?;
    let sair = MenuItem::with_id(app, "sair", labels.quit, true, None::<&str>)?;
    menu.append(&verificar_updates)?;
    menu.append(&sair)?;

    Ok(menu)
}

fn handle_menu_event(app_handle: &AppHandle, id: &str) {
    match id {
        "processar_clipboard" => {
            let _ = app_handle.emit("process-clipboard", ());
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
        _ => {}
    }
}

pub fn setup_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let app_handle = app.handle();
    let menu = build_tray_menu(app_handle, None)?;
    let tooltip = current_labels().tooltip;

    let tray = app.tray_by_id("main").unwrap_or_else(|| {
        tauri::tray::TrayIconBuilder::with_id("main")
            .tooltip(tooltip)
            .icon_as_template(true)
            .icon(app.default_window_icon().unwrap().clone())
            .build(app)
            .expect("failed to build tray icon")
    });

    tray.set_menu(Some(menu))?;

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

    let app_handle = app.handle().clone();
    tray.on_menu_event(move |_app, event| {
        handle_menu_event(&app_handle, event.id().as_ref());
    });

    Ok(())
}

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

#[tauri::command]
pub fn set_tray_language(app: AppHandle, lang: String) -> Result<(), String> {
    if let Ok(mut guard) = TRAY_LANG.lock() {
        *guard = lang;
    }
    let menu = build_tray_menu(&app, None).map_err(|e| e.to_string())?;
    let tray = app.tray_by_id("main").ok_or("tray not found")?;
    tray.set_menu(Some(menu)).map_err(|e| e.to_string())?;
    let _ = tray.set_tooltip(Some(current_labels().tooltip));
    Ok(())
}
