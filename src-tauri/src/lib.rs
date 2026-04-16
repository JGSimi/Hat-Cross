mod commands;
mod streaming;
mod tray;
mod windows;

use tauri_plugin_autostart::MacosLauncher;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_deep_link::init())
        .invoke_handler(tauri::generate_handler![
            commands::open_main_window,
            commands::toggle_popover_window,
            commands::close_window,
            commands::capture_screen,
            commands::set_autostart,
            commands::open_analysis_window,
            commands::send_notification,
            commands::set_provider_key,
            commands::get_provider_key_cmd,
            streaming::stream_chat,
            streaming::cancel_stream,
            streaming::fetch_models,
            tray::rebuild_tray_menu,
            tray::set_tray_icon,
        ])
        .setup(|app| {
            tray::setup_tray(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
