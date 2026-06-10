//! Auto-update sem licença de dev: o tauri-plugin-updater verifica os
//! artefatos com a chave minisign (própria, não Apple/MS) publicada no
//! GitHub Releases (latest.json). A 1ª instalação tem o aviso de app
//! não-assinado (Gatekeeper/SmartScreen); as ATUALIZAÇÕES são automáticas.
//!
//! Estratégia: no boot, em background e best-effort, checa → baixa → instala.
//! Não força restart (o app é de bandeja, inicia no login) — a nova versão
//! passa a valer no próximo start. Falhas são silenciosas (sem rede, etc.).

use tauri::AppHandle;
use tauri_plugin_updater::UpdaterExt;

pub fn spawn_check(app: &AppHandle) {
    let handle = app.clone();
    tauri::async_runtime::spawn(async move {
        if let Err(err) = try_update(&handle).await {
            eprintln!("[updater] check falhou (ignorado): {err}");
        }
    });
}

async fn try_update(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let updater = app.updater()?;
    let Some(update) = updater.check().await? else {
        return Ok(()); // já na última versão
    };
    // Baixa e instala silenciosamente; aplica no próximo start.
    update
        .download_and_install(|_chunk, _total| {}, || {})
        .await?;
    Ok(())
}
