use std::sync::Mutex;

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

// --- i18n ---
//
// Tray menus são strings embutidas no binário — não dá pra usar
// react-i18next. Mantemos um set de labels por idioma e um estado
// mutável com o idioma ativo. O TS chama `set_tray_language` quando
// o usuário troca, e a gente regenera o menu.

#[derive(Clone, Copy)]
struct TrayLabels {
    processing: &'static str,
    new_conversation: &'static str,
    process_clipboard: &'static str,
    recent_conversations: &'static str,
    main_window: &'static str,
    settings: &'static str,
    check_updates: &'static str,
    quit: &'static str,
    tooltip: &'static str,
}

const LABELS_PT_BR: TrayLabels = TrayLabels {
    processing: "⏳ Processando...",
    new_conversation: "Nova Conversa",
    process_clipboard: "Processar Clipboard",
    recent_conversations: "Conversas Recentes",
    main_window: "Janela Principal",
    settings: "Configurações",
    check_updates: "Verificar Atualizações",
    quit: "Sair",
    tooltip: "Hat — Assistente IA",
};

const LABELS_EN_US: TrayLabels = TrayLabels {
    processing: "⏳ Processing...",
    new_conversation: "New Conversation",
    process_clipboard: "Process Clipboard",
    recent_conversations: "Recent Conversations",
    main_window: "Main Window",
    settings: "Settings",
    check_updates: "Check for Updates",
    quit: "Quit",
    tooltip: "Hat — AI Assistant",
};

const LABELS_ES_ES: TrayLabels = TrayLabels {
    processing: "⏳ Procesando...",
    new_conversation: "Nueva Conversación",
    process_clipboard: "Procesar Portapapeles",
    recent_conversations: "Conversaciones Recientes",
    main_window: "Ventana Principal",
    settings: "Ajustes",
    check_updates: "Buscar Actualizaciones",
    quit: "Salir",
    tooltip: "Hat — Asistente IA",
};

fn labels_for(lang: &str) -> TrayLabels {
    match lang {
        "en-US" | "en" => LABELS_EN_US,
        "es-ES" | "es" => LABELS_ES_ES,
        _ => LABELS_PT_BR,
    }
}

// Estado global do idioma do tray. Inicializa em pt-BR e o TS sobrescreve
// após carregar settings.json. Mutex por ser escrita raramente.
static TRAY_LANG: Mutex<String> = Mutex::new(String::new());

fn current_labels() -> TrayLabels {
    let guard = TRAY_LANG.lock().ok();
    let lang_str = guard.as_ref().map(|g| g.as_str()).unwrap_or("pt-BR");
    labels_for(lang_str)
}

fn truncate_recent_title(title: &str) -> String {
    const MAX_CHARS: usize = 35;
    const TRUNCATED_CHARS: usize = 32;

    if title.chars().count() > MAX_CHARS {
        format!("{}...", title.chars().take(TRUNCATED_CHARS).collect::<String>())
    } else {
        title.to_string()
    }
}

// --- Build menu from state ---

fn build_tray_menu(app: &AppHandle, state: Option<&TrayState>) -> Result<Menu<tauri::Wry>, Box<dyn std::error::Error>> {
    let menu = Menu::new(app)?;
    let labels = current_labels();

    // Provider/model header (dynamic)
    if let Some(s) = state {
        let provider_item = MenuItem::with_id(app, "provider_label", &s.provider_label, false, None::<&str>)?;
        menu.append(&provider_item)?;

        if s.is_processing {
            let processing_item = MenuItem::with_id(app, "processing", labels.processing, false, None::<&str>)?;
            menu.append(&processing_item)?;
        }

        menu.append(&PredefinedMenuItem::separator(app)?)?;
    }

    // New conversation
    let nova_conversa = MenuItem::with_id(app, "nova_conversa", labels.new_conversation, true, None::<&str>)?;
    menu.append(&nova_conversa)?;

    menu.append(&PredefinedMenuItem::separator(app)?)?;

    // Quick actions
    let processar_clipboard = MenuItem::with_id(app, "processar_clipboard", labels.process_clipboard, true, None::<&str>)?;
    menu.append(&processar_clipboard)?;

    menu.append(&PredefinedMenuItem::separator(app)?)?;

    // Recent conversations submenu (dynamic)
    if let Some(s) = state {
        if !s.recent_conversations.is_empty() {
            let submenu = Submenu::new(app, labels.recent_conversations, true)?;
            for conv in s.recent_conversations.iter().take(5) {
                let title = truncate_recent_title(&conv.title);
                let item_id = format!("conv_{}", conv.id);
                let item = MenuItem::with_id(app, &item_id, &title, true, None::<&str>)?;
                submenu.append(&item)?;
            }
            menu.append(&submenu)?;
            menu.append(&PredefinedMenuItem::separator(app)?)?;
        }
    }

    // Window & settings
    let janela_principal = MenuItem::with_id(app, "janela_principal", labels.main_window, true, None::<&str>)?;
    let configuracoes = MenuItem::with_id(app, "configuracoes", labels.settings, true, None::<&str>)?;
    menu.append(&janela_principal)?;
    menu.append(&configuracoes)?;

    menu.append(&PredefinedMenuItem::separator(app)?)?;

    // Updates & exit
    let verificar_updates = MenuItem::with_id(app, "verificar_updates", labels.check_updates, true, None::<&str>)?;
    let sair = MenuItem::with_id(app, "sair", labels.quit, true, None::<&str>)?;
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

// Troca o idioma do tray e regenera o menu sem estado dinâmico —
// o próximo rebuild_tray_menu com state vai pegar o idioma novo.
#[tauri::command]
pub fn set_tray_language(app: AppHandle, lang: String) -> Result<(), String> {
    if let Ok(mut guard) = TRAY_LANG.lock() {
        *guard = lang;
    }
    // Regenera com estado "vazio" (mantém o essencial — header dinâmico
    // volta na próxima rebuild_tray_menu vinda do JS).
    let menu = build_tray_menu(&app, None).map_err(|e| e.to_string())?;
    let tray = app.tray_by_id("main").ok_or("tray not found")?;
    tray.set_menu(Some(menu)).map_err(|e| e.to_string())?;
    let _ = tray.set_tooltip(Some(current_labels().tooltip));
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::truncate_recent_title;

    #[test]
    fn truncates_recent_titles_on_char_boundaries() {
        let title = "Conversa com emoji 🚀 e acentos áéíóú sobre Windows";

        let truncated = truncate_recent_title(title);

        assert!(truncated.ends_with("..."));
        assert!(truncated.len() < title.len());
        assert_eq!(truncated.chars().count(), 35);
    }

    #[test]
    fn keeps_short_unicode_titles_unchanged() {
        let title = "Pergunta matemática 🚀";

        assert_eq!(truncate_recent_title(title), title);
    }
}
