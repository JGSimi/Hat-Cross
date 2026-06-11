mod clipboard;
mod flash_window;
mod macos_overlay;
mod oauth;
mod shortcuts;
mod stream;
mod tray;
mod updates;

use tauri_plugin_autostart::MacosLauncher;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(shortcuts::plugin())
        .setup(|app| {
            // Sem ícone no Dock (macOS) — e pré-requisito para o overlay
            // aparecer sobre Spaces fullscreen.
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            let handle = app.handle();
            // Janela flash pré-aquecida: criada AGORA, oculta. O caminho do
            // atalho só mostra/posiciona — nunca cria janela (orçamento p95).
            flash_window::create_prewarmed(handle)?;
            tray::create(handle)?;
            shortcuts::register_from_settings(handle)?;
            // Auto-update em background (sem licença de dev — minisign).
            updates::spawn_check(handle);

            // Conveniência de dev: abre a janela principal no boot. Em release
            // o app fica só na bandeja (comportamento stealth do produto).
            #[cfg(debug_assertions)]
            if let Some(main) = tauri::Manager::get_webview_window(handle, "main") {
                let _ = main.show();
                let _ = main.set_focus();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            flash_window::flash_hide,
            flash_window::flash_show_text,
            flash_window::flash_enter_adjust_mode,
            flash_window::flash_save_position,
            flash_window::get_flash_appearance,
            flash_window::set_flash_appearance,
            flash_window::gabarito_show,
            flash_window::gabarito_hide,
            shortcuts::set_shortcuts,
            shortcuts::get_shortcuts,
            stream::start_stream,
            stream::cancel_stream,
            clipboard::read_clipboard,
            oauth::oauth_run_loopback_flow,
            oauth::open_external,
            updates::check_for_update,
        ])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o Hat");
}
