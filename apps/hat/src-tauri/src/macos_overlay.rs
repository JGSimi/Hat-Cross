// Porte do app legado: janelas overlay sobre apps em tela cheia no macOS.
// `always_on_top(true)` + `visible_on_all_workspaces(true)` da Tauri cobrem
// Spaces normais; o flag que falta é NSWindowCollectionBehaviorFullScreenAuxiliary.
// No-op nas demais plataformas (Windows 11 honra always_on_top nativamente).
//
// Upgrade futuro planejado: tauri-nspanel (painel não-ativante de verdade).
// Este bridge de ~70 linhas é o fallback documentado no ADR-001.

use tauri::WebviewWindow;

pub enum OverlayLevel {
    /// NSMainMenuWindowLevel - 1 (23) — o mais alto prático. Usado pelo flash.
    Top,
}

#[cfg(target_os = "macos")]
pub fn apply_fullscreen_overlay(window: &WebviewWindow, level: OverlayLevel) {
    use objc2::msg_send;
    use objc2::runtime::AnyObject;

    let ptr = match window.ns_window() {
        Ok(p) => p,
        Err(_) => return,
    };
    if ptr.is_null() {
        return;
    }

    // NSWindowCollectionBehavior (ABI estável desde 10.5):
    //   CanJoinAllSpaces    = 1 << 0
    //   Stationary          = 1 << 4
    //   FullScreenAuxiliary = 1 << 8  → aparece SOBRE apps em fullscreen
    const NS_COLLECTION_CAN_JOIN_ALL_SPACES: u64 = 1 << 0;
    const NS_COLLECTION_STATIONARY: u64 = 1 << 4;
    const NS_COLLECTION_FULL_SCREEN_AUXILIARY: u64 = 1 << 8;

    let behavior: u64 = NS_COLLECTION_CAN_JOIN_ALL_SPACES
        | NS_COLLECTION_STATIONARY
        | NS_COLLECTION_FULL_SCREEN_AUXILIARY;

    let ns_level: i64 = match level {
        OverlayLevel::Top => 23,
    };

    unsafe {
        let ns_window: *mut AnyObject = ptr.cast();
        let _: () = msg_send![ns_window, setCollectionBehavior: behavior];
        let _: () = msg_send![ns_window, setLevel: ns_level];
    }
}

#[cfg(not(target_os = "macos"))]
pub fn apply_fullscreen_overlay(_window: &WebviewWindow, _level: OverlayLevel) {}
