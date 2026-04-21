mod commands;
mod oauth;
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
            commands::quit_app,
            commands::set_autostart,
            commands::send_notification,
            commands::flash_ensure,
            commands::flash_show,
            commands::flash_hide,
            commands::flash_enter_adjust_mode,
            commands::flash_exit_adjust_mode,
            streaming::stream_chat_hat,
            streaming::cancel_stream,
            oauth::oauth_start_server,
            oauth::open_external_url,
            tray::rebuild_tray_menu,
            tray::set_tray_icon,
            tray::set_tray_language,
        ])
        .setup(|app| {
            tray::setup_tray(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
