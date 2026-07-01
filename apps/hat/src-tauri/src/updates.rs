//! Auto-update sem licença de dev: o tauri-plugin-updater verifica os
//! artefatos com a chave minisign (própria, não Apple/MS) publicada no
//! GitHub Releases (latest.json). A 1ª instalação tem o aviso de app
//! não-assinado (Gatekeeper/SmartScreen); as ATUALIZAÇÕES são automáticas.
//!
//! Estratégia: no boot, em background e best-effort, checa → baixa → instala.
//! Não força restart (o app é de bandeja, inicia no login) — a nova versão
//! passa a valer no próximo start. Falhas são silenciosas (sem rede, etc.).

use tauri::{AppHandle, Emitter};
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
    let version = update.version.clone();
    // Baixa e instala silenciosamente; aplica no próximo start.
    update
        .download_and_install(|_chunk, _total| {}, || {})
        .await?;
    // Instalada e pronta: avisa o front para revelar o botão "reiniciar para
    // atualizar" (usuário não verifica manual — o sistema avisa, ele só clica).
    let _ = app.emit("update:ready", serde_json::json!({ "version": version }));
    Ok(())
}

/// Reinicia o app para aplicar a atualização já baixada. Diverge (não retorna).
#[tauri::command]
pub fn relaunch_app(app: AppHandle) {
    app.restart();
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCheck {
    /// "uptodate" | "updated" | "error"
    pub status: String,
    pub version: Option<String>,
    pub message: Option<String>,
}

/// Verifica e instala atualização sob demanda (botão na tela de Ajustes).
/// Aplica no próximo start. Best-effort, com status legível para a UI.
#[tauri::command]
pub async fn check_for_update(app: AppHandle) -> UpdateCheck {
    let updater = match app.updater() {
        Ok(u) => u,
        Err(e) => {
            return UpdateCheck {
                status: "error".into(),
                version: None,
                message: Some(e.to_string()),
            }
        }
    };
    match updater.check().await {
        Ok(Some(update)) => {
            let version = update.version.clone();
            match update.download_and_install(|_, _| {}, || {}).await {
                Ok(()) => UpdateCheck {
                    status: "updated".into(),
                    version: Some(version),
                    message: None,
                },
                Err(e) => UpdateCheck {
                    status: "error".into(),
                    version: Some(version),
                    message: Some(e.to_string()),
                },
            }
        }
        Ok(None) => UpdateCheck {
            status: "uptodate".into(),
            version: None,
            message: None,
        },
        Err(e) => UpdateCheck {
            status: "error".into(),
            version: None,
            message: Some(e.to_string()),
        },
    }
}
