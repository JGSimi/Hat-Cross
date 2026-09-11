use tauri::{AppHandle, Manager};
use tauri_plugin_store::StoreExt;

const KEY: &str = "hideInScreenCaptures";

fn preference(value: Option<serde_json::Value>) -> bool {
    value.and_then(|v| v.as_bool()).unwrap_or(true)
}

pub fn enabled(app: &AppHandle) -> bool {
    preference(app.store("settings.json").ok().and_then(|store| store.get(KEY)))
}

pub fn apply(app: &AppHandle, enabled: bool) -> Result<(), String> {
    for window in app.webview_windows().values() {
        window.set_content_protected(enabled).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn get_capture_protection(app: AppHandle) -> bool {
    enabled(&app)
}

#[tauri::command]
pub fn set_capture_protection(app: AppHandle, enabled: bool) -> Result<(), String> {
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    let previous = preference(store.get(KEY));
    if let Err(error) = apply(&app, enabled) {
        let _ = apply(&app, previous);
        return Err(error);
    }
    store.set(KEY, serde_json::json!(enabled));
    if let Err(error) = store.save() {
        store.set(KEY, serde_json::json!(previous));
        let _ = apply(&app, previous);
        return Err(error.to_string());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn capture_preference_defaults_on_and_preserves_explicit_off() {
        assert!(preference(None));
        assert!(preference(Some(serde_json::json!(null))));
        assert!(preference(Some(serde_json::json!("false"))));
        assert!(preference(Some(serde_json::json!(true))));
        assert!(!preference(Some(serde_json::json!(false))));
    }
}
