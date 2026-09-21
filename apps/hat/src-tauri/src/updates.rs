//! Auto-update sem licença de dev: artefatos assinados com minisign.
//! Stable e Beta usam endpoints separados nas respectivas configs Tauri.

use std::sync::Mutex;

use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_updater::UpdaterExt;

#[derive(Default)]
pub struct UpdateState {
    ready_version: Mutex<Option<String>>,
}

fn set_ready(app: &AppHandle, version: String) {
    if let Ok(mut ready) = app.state::<UpdateState>().ready_version.lock() {
        *ready = Some(version);
    }
}

#[tauri::command]
pub fn get_update_ready(app: AppHandle) -> Option<String> {
    app.state::<UpdateState>()
        .ready_version
        .lock()
        .ok()
        .and_then(|ready| ready.clone())
}

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
        return Ok(());
    };
    let version = update.version.clone();
    update.download_and_install(|_chunk, _total| {}, || {}).await?;
    set_ready(app, version.clone());
    let _ = app.emit("update:ready", serde_json::json!({ "version": version }));
    Ok(())
}

#[tauri::command]
pub fn relaunch_app(app: AppHandle) {
    app.restart();
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCheck {
    pub status: String,
    pub version: Option<String>,
    pub message: Option<String>,
}

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
                Ok(()) => {
                    set_ready(&app, version.clone());
                    let _ = app.emit("update:ready", serde_json::json!({ "version": version.clone() }));
                    UpdateCheck {
                        status: "updated".into(),
                        version: Some(version),
                        message: None,
                    }
                }
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
