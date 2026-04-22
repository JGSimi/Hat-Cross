// Configura janelas (popover + flash) pra aparecerem sobre apps em tela
// cheia no macOS. Sem isso, quando um outro app entra em fullscreen (cria
// um Space dedicado), o Hat fica invisível — `always_on_top(true)` e
// `visible_on_all_workspaces(true)` da Tauri só cobrem Spaces normais.
// O flag que falta é NSWindowCollectionBehaviorFullScreenAuxiliary.
//
// No-op em outras plataformas: Windows 11 honra always_on_top em fullscreen
// de forma nativa, e a maioria dos DEs Linux (GNOME, KDE) tbm.

use tauri::WebviewWindow;

pub enum OverlayLevel {
    /// NSFloatingWindowLevel (3) — acima de janelas normais, abaixo do menu.
    /// Bom pro popover: continua respeitando Cmd+Tab sem virar um stalker.
    Floating,
    /// NSMainMenuWindowLevel - 1 (23) — o mais alto prático sem virar popup
    /// de sistema. Usado pelo flash, que precisa piscar mesmo sobre
    /// fullscreen.
    Top,
}

#[cfg(target_os = "macos")]
pub fn apply_fullscreen_overlay(window: &WebviewWindow, level: OverlayLevel) {
    use objc2::runtime::AnyObject;
    use objc2::msg_send;

    let ptr = match window.ns_window() {
        Ok(p) => p,
        Err(_) => return,
    };
    if ptr.is_null() {
        return;
    }

    // NSWindowCollectionBehavior flags (valores na ABI Cocoa, estáveis desde
    // 10.5). Combinados via OR. Docs Apple: developer.apple.com/...
    //   CanJoinAllSpaces      = 1 << 0   → aparece em Spaces normais
    //   Stationary            = 1 << 4   → não anima ao trocar de Space
    //   FullScreenAuxiliary   = 1 << 8   → aparece SOBRE apps em fullscreen
    const NS_COLLECTION_CAN_JOIN_ALL_SPACES: u64 = 1 << 0;
    const NS_COLLECTION_STATIONARY: u64 = 1 << 4;
    const NS_COLLECTION_FULL_SCREEN_AUXILIARY: u64 = 1 << 8;

    let behavior: u64 = NS_COLLECTION_CAN_JOIN_ALL_SPACES
        | NS_COLLECTION_STATIONARY
        | NS_COLLECTION_FULL_SCREEN_AUXILIARY;

    // NSWindowLevel constants (mesma ABI estável):
    //   NSNormalWindowLevel      = 0
    //   NSFloatingWindowLevel    = 3
    //   NSMainMenuWindowLevel    = 24
    let ns_level: i64 = match level {
        OverlayLevel::Floating => 3,
        OverlayLevel::Top => 23,
    };

    // Chamadas ObjC diretas via msg_send — evita ter que expressar os tipos
    // completos da hierarquia NSWindow/NSResponder do objc2-app-kit, que
    // exigiriam MainThreadMarker. A Tauri já garante que estamos no main
    // thread quando o webview é criado.
    unsafe {
        let ns_window: *mut AnyObject = ptr.cast();
        let _: () = msg_send![ns_window, setCollectionBehavior: behavior];
        let _: () = msg_send![ns_window, setLevel: ns_level];
    }
}

#[cfg(not(target_os = "macos"))]
pub fn apply_fullscreen_overlay(_window: &WebviewWindow, _level: OverlayLevel) {
    // Windows + Linux: always_on_top + visible_on_all_workspaces do builder
    // já cobrem os casos comuns. Nada pra fazer aqui.
}
