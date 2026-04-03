mod commands;
mod shortcuts;
mod streaming;
mod tray;
mod windows;

use tauri_plugin_autostart::MacosLauncher;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Plugins
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
        // Invoke handlers
        .invoke_handler(tauri::generate_handler![
            commands::toggle_popover,
            commands::open_main_window,
            commands::open_quick_input,
            commands::close_window,
            commands::hide_popover_temporarily,
            commands::capture_screen,
            streaming::stream_chat,
            streaming::cancel_stream,
            streaming::fetch_models,
            commands::set_autostart,
            commands::open_analysis_window,
            commands::send_notification,
        ])
        // Setup
        .setup(|app| {
            tray::setup_tray(app)?;
            shortcuts::register_default_shortcuts(app.handle())?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
