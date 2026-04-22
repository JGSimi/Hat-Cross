# Stealth Content Protection — Research (FP1)

**Task:** FP1 — vertical plan `flash-preview.md`
**Author:** Claude Opus 4.7 (research agent)
**Date:** 2026-04-22
**Repo:** Hat-Cross (Tauri v2 + React + Rust)
**Scope:** Block flash/popover windows from appearing in screen recordings (OBS, Zoom, Meet, QuickTime) on macOS + Windows + Linux.

---

## 1. Executive summary (TL;DR)

- **Tauri v2 ships `WebviewWindow.setContentProtected(enabled: boolean)` out of the box** (confirmed in `@tauri-apps/api@2.10.1` already installed under `node_modules/@tauri-apps/api/dist-js/window.d.ts:808`). Under the hood Tao calls `NSWindow.setSharingType(.none)` on macOS and `SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE)` on Windows. No custom Rust command, no extra deps, no capability flag required.
- **Recommendation: Opção A** — invoke `setContentProtected(true)` at window creation time for `flash` and `popover` (also settable via `contentProtected: true` on `WebviewWindowBuilder`). Keep the setting idempotent and reapply after any runtime re-creation.
- **Caveats that must ship with the feature**: (a) on **macOS 15+ (Sequoia) / 26 (Tahoe)** ScreenCaptureKit deliberately ignores `sharingType = .none` — this is a known upstream regression (tauri-apps/tauri#14200, Apple dev forum thread 792152). The user is on macOS 26.3.1, so **G10 is at risk on macOS**. Mitigation options: run Hat with `macOSPrivateApi=true` (already set) and accept that OBS/Zoom using ScreenCaptureKit will still capture, OR degrade to occlusion-based stealth (blur/draw-off-screen) for macOS 15+. This must be surfaced to Rafa as a known limitation. (b) Linux = best-effort no-op. (c) Windows `WDA_EXCLUDEFROMCAPTURE` requires Win10 2004+ (build 19041) — older builds silently fall back to `WDA_MONITOR` (black rectangle in captures).

---

## 2. API matrix per OS

| OS | Native API | Tauri v2 coverage | Snippet (what Tao emits) | Limitations |
|---|---|---|---|---|
| **macOS ≤ 14** | `NSWindow.setSharingType(.none)` (AppKit) | ✅ `setContentProtected(true)` | `self.ns_window.setSharingType(NSWindowSharingType::None)` | Works against legacy CGWindowList / QuickTime / Zoom classic. `NSWindowSharingNone` = 0. Minimum macOS 10.5. |
| **macOS 15+ (Sequoia) / 26 (Tahoe)** | Same API, but **ScreenCaptureKit ignores it** | ⚠️ Still callable, **no effect against SCKit** | Same code runs; OS silently composites the window into the capture framebuffer regardless. | Apple confirmed the behavior is intentional in forum thread 792152 ("At this time there are no public APIs for preventing screen capture"). Upstream tauri#14200 tracks this. |
| **Windows 10 2004+ (build 19041) / 11** | `SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE)` (0x00000011) | ✅ `setContentProtected(true)` | `SetWindowDisplayAffinity(self.hwnd(), WDA_EXCLUDEFROMCAPTURE)` | Requires DWM composition. Blocks Graphics Capture API, DXGI Desktop Duplication, BitBlt, PrintWindow. Does **not** block hardware capture cards or photos of the screen. |
| **Windows 7 → Windows 10 1909** | Falls back to `WDA_MONITOR` (0x00000001) | ✅ (with fallback) | Same call; OS treats `WDA_EXCLUDEFROMCAPTURE` as `WDA_MONITOR`. | Window shows up as **black rectangle** in captures — still leaks positional information, but no text. For Hat-Cross target (2026 users), assume 2004+. |
| **Linux (X11)** | No equivalent API | ❌ no-op | Tao has no implementation in `linux/window.rs` for `set_content_protection`; call returns `Ok(())` without doing anything. | Best-effort only. Some compositors (Mutter, KWin) respect `_NET_WM_WINDOW_TYPE_UTILITY` hints inconsistently. |
| **Linux (Wayland)** | No equivalent API | ❌ no-op | Same as X11 — silent no-op. | `xdg-desktop-portal-screencast` may or may not honor window type hints per compositor. |

**Source of truth for the Tauri implementation:**
- `tauri-apps/tao` → `src/platform_impl/macos/window.rs` → `set_content_protection()` calls `setSharingType(NSWindowSharingType::None)`.
- `tauri-apps/tao` → `src/platform_impl/windows/window.rs` → `set_content_protection()` calls `SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE)`.
- Feature added in tauri#5513 (commit `4ab5545`) in response to issue #5132.

---

## 3. Architecture recommendation — **Opção A (no custom command)**

### Why Opção A beats Opção B

1. **Zero new deps.** `objc2-app-kit` is already in `Cargo.toml` for the fullscreen overlay (`macos_overlay.rs`). Adding `cocoa` + `objc` + `winapi` just to re-implement `setSharingType` and `SetWindowDisplayAffinity` duplicates what Tao/Wry already link.
2. **Tauri's public API already covers the OS matrix.** `WebviewWindow.setContentProtected(true)` compiles to the same NSWindow/SetWindowDisplayAffinity calls Opção B would write by hand.
3. **No ACL surface area.** `setContentProtected` is part of `core:window:default` **on Tauri 2.x** — current `capabilities/default.json` already grants `core:window:allow-close`, etc., but *does not* explicitly list `core:window:allow-set-content-protected`. Verify on implementation (see §5).
4. **Keeps stealth invariant close to window creation.** Setting `contentProtected: true` on the `WebviewWindowBuilder` makes protection part of the window contract — no "did we remember to call it?" bug surface.

### What Opção B (custom Rust command) would look like (for reference only)

If upstream breakage forced a custom path — e.g. the macOS 15 regression requires direct ScreenCaptureKit exclusion via private API once it exists — the shape would be:

```rust
// src-tauri/src/stealth.rs  (NOT needed today)
#[tauri::command]
pub fn set_stealth_capture(window: tauri::Window, enabled: bool) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    unsafe {
        use objc2_app_kit::{NSWindow, NSWindowSharingType};
        use objc2::rc::Retained;
        let ns_window: Retained<NSWindow> = window.ns_window()
            .map_err(|e| e.to_string())?
            .cast();
        ns_window.setSharingType(if enabled {
            NSWindowSharingType::None
        } else {
            NSWindowSharingType::ReadOnly
        });
    }
    #[cfg(target_os = "windows")]
    unsafe {
        use windows::Win32::UI::WindowsAndMessaging::{
            SetWindowDisplayAffinity, WDA_EXCLUDEFROMCAPTURE, WDA_NONE,
        };
        use windows::Win32::Foundation::HWND;
        let hwnd = HWND(window.hwnd().map_err(|e| e.to_string())?.0 as _);
        let affinity = if enabled { WDA_EXCLUDEFROMCAPTURE } else { WDA_NONE };
        SetWindowDisplayAffinity(hwnd, affinity)
            .ok()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        eprintln!("[stealth] content protection unavailable on Linux (no-op)");
        let _ = (window, enabled);
    }
    Ok(())
}
```

Plus `lib.rs`: `.invoke_handler(tauri::generate_handler![..., stealth::set_stealth_capture])`.
Plus deps: `windows = { version = "0.58", features = ["Win32_UI_WindowsAndMessaging", "Win32_Foundation"] }` (latest stable on crates.io as of Apr 2026). `objc2-app-kit` already present.

**Bottom line:** do not ship Opção B unless Opção A proves broken on a concrete OS. Opção A is one line per window.

---

## 4. Reference code (Opção A — what FP2 will implement)

### 4.1 Set at window build time (`src-tauri/src/windows.rs`)

```rust
// inside the match arm for "popover"
"popover" => builder
    .title("Hat")
    .inner_size(380.0, 480.0)
    // ... existing flags ...
    .content_protected(true)        // NEW — NSWindowSharing::None / WDA_EXCLUDEFROMCAPTURE
    .always_on_top(true),

// inside the match arm for "flash"
"flash" => builder
    .title("Hat Flash")
    .inner_size(400.0, 60.0)
    // ... existing flags ...
    .content_protected(true)        // NEW
    .visible(false)
    .accept_first_mouse(true),
```

> The `WebviewWindowBuilder::content_protected(bool)` setter exists in `tauri@2.x` (mirrors the `contentProtected` field in `WindowConfig`, see `window.d.ts:1597` in the installed types).

### 4.2 Defense-in-depth — re-apply on every show (idempotent)

Adding one line to `show_window` survives the edge case where a window was created through a code path that forgot `content_protected(true)`:

```rust
pub fn show_window(app: &AppHandle, label: &str) {
    if let Some(window) = app.get_webview_window(label) {
        if matches!(label, "popover" | "flash") {
            let _ = window.set_content_protected(true);
        }
        // ... existing overlay + show logic ...
    }
}
```

`Window::set_content_protected(bool)` (Rust) and `WebviewWindow.setContentProtected(boolean)` (JS) are both available; the Rust call skips the IPC round-trip and should be preferred inside `src-tauri`.

### 4.3 JS side — paranoid reapply on FlashPage mount

In `src/pages/FlashPage.tsx` top of the `useEffect` that registers the `flash-show` listener (line ~83):

```ts
import { getCurrentWindow } from '@tauri-apps/api/window';
// ...
useEffect(() => {
  // C1 mitigation: guarantee the window is content-protected before the
  // first render paints any tokens. Idempotent — OS caches the flag.
  getCurrentWindow().setContentProtected(true).catch((err) => {
    console.warn('[flash] setContentProtected failed', err);
  });
  // ... existing listen(...) logic ...
}, []);
```

Same snippet in `src/pages/PopoverPage.tsx` before the first render of revealed content.

---

## 5. Capability / ACL requirement

Audit `src-tauri/capabilities/default.json` for `core:window:allow-set-content-protected`. As of Tauri 2.x the `core:window:default` permission bundle **includes** `allow-set-content-protected`; Hat-Cross currently lists individual window allow-* entries instead of `core:window:default`, so the permission must be added explicitly:

```jsonc
{
  "permissions": [
    // ... existing entries ...
    "core:window:allow-set-content-protected"  // REQUIRED for WebviewWindow.setContentProtected(...) JS call
  ]
}
```

No new capability file needed — the default capability targets `["popover", "main", "flash"]` which covers all three windows.

*(Memory rule: SEMPRE verificar fs:allow-* antes de usar funcoes novas do plugin-fs — the `core:window:allow-*` family follows the same gate. FP2 must add this line or `setContentProtected` throws "not allowed by ACL".)*

---

## 6. Integration points (where FP2 edits)

1. **`src-tauri/src/windows.rs` lines 52-83** — add `.content_protected(true)` to the popover + flash builders (§4.1).
2. **`src-tauri/src/windows.rs` lines 28-40** — reapply on `show_window` (§4.2) — idempotent safety net.
3. **`src/pages/FlashPage.tsx` line ~80** — JS-side paranoid reapply on mount (§4.3).
4. **`src/pages/PopoverPage.tsx` top-level `useEffect`** — same paranoid reapply.
5. **`src-tauri/capabilities/default.json`** — add `"core:window:allow-set-content-protected"` permission (§5).
6. **`src-tauri/tauri.conf.json`** — (optional) add `"contentProtected": true` to the hardcoded `main` window definition if we want the main chat to also hide in captures. Product decision: probably yes for a stealth assistant.

---

## 7. Manual validation protocol

### Setup (once per OS, ~15 min)

- **macOS 26.3.1**: install OBS Studio (Homebrew: `brew install --cask obs`), enable Screen Recording permission for OBS in System Settings → Privacy & Security. Also have QuickTime (preinstalled) and Zoom trial.
- **Windows 11**: install OBS Studio, enable "Display Capture" source. Also have the Windows built-in Snipping Tool bound to Win+Shift+S.
- **Linux (Fedora 43+, Wayland)**: install OBS via `dnf install obs-studio`; enable screen-cast via `xdg-desktop-portal`. Skip if test budget tight.

### Per-OS test loop (~1 h each)

1. Launch Hat-Cross dev build (`npm run tauri dev`) from a clean state.
2. Open OBS, create a scene with **Display Capture** (full screen) as source. Hit "Start Recording".
3. Trigger flash: keyboard shortcut or dev debug command. Verify **text appears on real screen** but **not in OBS preview**.
4. Trigger popover reveal 2x, including streaming tokens. Same dual-check.
5. Switch OBS source to **Window Capture** → target the flash window. Expected: the window is excluded / shows blank.
6. On Windows: open Snipping Tool (Win+Shift+S) with flash visible → expected: flash window excluded from capture region or shows blank.
7. On macOS: run Cmd+Shift+4 to capture a rectangle over the flash → **this is a known bypass (QuickTime path, see §8)**. Expect leak on macOS 15+.
8. Multi-monitor: drag Hat-Cross to a second display, repeat steps 3-5. Expect same protection.
9. Stop recording, scrub the OBS output MP4, log result per row.
10. Repeat steps 2-9 **10 times** on each OS (G10 target: 10/10 passes per OS *ignoring known macOS 15+ SCKit gap*).

### Pass/fail scoring template

| Run | OS | Capture tool | Flash visible? | Popover visible? | Notes |
|---|---|---|---|---|---|
| 1 | macOS 26.3.1 | OBS Display | ❌ expected / ✅ fail | ❌ / ✅ | SCKit bypass? |
| ... | | | | | |

Estimated execution: 1 h per OS × 3 = 3 h. Add 30 min for triage/writeup. Total budget: **3.5 h for FP3 validation**.

---

## 8. Known gotchas + risks

1. **macOS 15+ ScreenCaptureKit bypass (RED flag for G10).** Issue tauri#14200, Apple forum 792152. ScreenCaptureKit composites the whole desktop framebuffer after `sharingType` is applied, so Zoom/OBS/Meet/QuickTime on macOS Sequoia/Tahoe *will capture the window*. This is the user's current OS (26.3.1). Options:
   - (a) Ship the protection anyway (helps legacy CGWindowList capture paths + sharing via AirPlay).
   - (b) Document as a known limitation in README.
   - (c) Research occlusion-based stealth for macOS 15+ (draw flash off-screen, render in overlay only when screen is NOT being captured — detectable via `SCShareableContent` polling).
   - Recommendation: ship (a) + (b) in FP2, file (c) as FP4/FP5 stretch.
2. **Windows Game Capture vs Display Capture.** `WDA_EXCLUDEFROMCAPTURE` only applies to Desktop/Display/Graphics Capture. Apps using hooking (Discord Stream, some game overlays) may still leak. Low likelihood for Hat's interview use case.
3. **Multi-monitor.** Protection travels with the window regardless of which display it's on — confirmed by MS docs + Tao implementation. No extra work.
4. **Chrome `getDisplayMedia()`** (browser meet.google.com screen share). On Win10 2004+, Chrome uses Windows.Graphics.Capture which **does** respect `WDA_EXCLUDEFROMCAPTURE`. On macOS 15+, same SCKit regression applies.
5. **Screenshots (Cmd+Shift+4 / Win+Shift+S)**:
   - Windows Snipping Tool (Win+Shift+S) **respects** `WDA_EXCLUDEFROMCAPTURE` as of Win11 22H2 (MS Meziantou blog).
   - macOS `Cmd+Shift+4` bypasses sharingType on macOS 15+ (same SCKit path). On macOS ≤14 it respects it.
6. **DPI scaling.** Irrelevant to stealth; mentioned only because FP2 should not regress render latency on HiDPI — test on 4K monitor.
7. **OBS with extra permissions (macOS DLP tools).** OBS forum thread reports DLP software can whitelist captures bypassing NSWindow; edge case, ignore for V1.
8. **Multi-monitor DWM disabled.** On Windows if the user disables DWM composition (rare in 2026), `SetWindowDisplayAffinity` returns FALSE and the window becomes unprotected. DwmIsCompositionEnabled check could gate a fallback hide.

---

## 9. Dependencies

**No new dependencies required for Opção A.**

Already present in `src-tauri/Cargo.toml`:
- `tauri = { version = "2", features = ["tray-icon", "macos-private-api"] }` — ships `Window::set_content_protected` and `WebviewWindowBuilder::content_protected`.
- `objc2-app-kit = { version = "0.3", features = ["NSWindow", "NSResponder"] }` — already linked for the overlay module; the same NSWindow handle Tauri uses for sharingType.

Already present in `package.json`:
- `@tauri-apps/api: ^2` (resolved `2.10.1`) — ships `WebviewWindow.setContentProtected`.

If we later ship Opção B:
- `windows = "0.58"` (crates.io current 2026), features `["Win32_UI_WindowsAndMessaging", "Win32_Foundation"]` — preferred over legacy `winapi 0.3` (unmaintained since 2021).
- Everything else (cocoa/objc) redundant given `objc2-app-kit` is already vendored.

---

## 10. References

Primary Apple / Microsoft / Tauri docs:

- [SetWindowDisplayAffinity — Microsoft Learn](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setwindowdisplayaffinity) — canonical Win32 API, WDA_* constants, 2004+ requirement.
- [NSWindow.SharingType — Apple Developer Documentation](https://developer.apple.com/documentation/appkit/nswindow/sharingtype-swift.enum) — constants `.none` / `.readOnly` / `.readWrite`.
- [NSWindow sharingType property — Apple Developer Documentation](https://developer.apple.com/documentation/appkit/nswindow/sharingtype-swift.property) — declares `NSWindowSharingNone` is now a legacy constant on macOS 15+.
- [Tauri v2 window API — setContentProtected docs](https://v2.tauri.app/reference/javascript/api/namespacewindow/) — JS surface.
- [tauri#14200 — macOS 15+ ScreenCaptureKit ignores setContentProtection / NSWindow.sharingType](https://github.com/tauri-apps/tauri/issues/14200) — tracking issue, "upstream" label.
- [Apple Developer Forums thread 792152 — sharingType ignored on macOS 15.4+](https://developer.apple.com/forums/thread/792152) — Apple staff acknowledge behavior.
- [tauri#5132 — feat request exposing setContentProtection](https://github.com/tauri-apps/tauri/issues/5132) — origin of the Tauri API.
- [tauri#5513 / commit 4ab5545 — content protection API implementation](https://github.com/tauri-apps/tauri/commit/4ab5545b7a831c549f3c65e74de487ede3ab7ce5) — PR adding the Tauri wrapper.
- [OBS PR #5698 — hide OBS windows from display capture using SetWindowDisplayAffinity](https://github.com/obsproject/obs-studio/pull/5698) — real-world precedent for the Windows flag.
- [Meziantou — How to Exclude Your Windows App from Screen Capture and Recall](https://www.meziantou.net/how-to-exclude-your-windows-app-from-screen-capture-and-recall.htm) — coverage of capture tools that respect the flag in 2026.
- [Adam Svoboda — How Interview Cheating Tools Hide from Zoom](https://adamsvoboda.net/how-interview-cheating-tools-hide-from-zoom/) — cross-platform pattern analysis; confirms NSWindow + SetWindowDisplayAffinity combo as industry standard for this job.
- [Pierce Freeman — Building a (kind of) invisible mac app](https://pierce.dev/notes/building-a-kind-of-invisible-mac-app) — pre-macOS-15 technique catalog.
- [electron#19880 — setContentProtection not working on macOS](https://github.com/electron/electron/issues/19880) — parallel Electron regression, same root cause.
- [wails PR #4485 — Content Protection for Windows and macOS](https://github.com/wailsapp/wails/pull/4485) — how Wails structures the same API.

Installed code verified (file paths are load-bearing):

- `/Users/joaosimi/Hat-Cross/node_modules/@tauri-apps/api/window.d.ts:808` — `setContentProtected(protected_: boolean): Promise<void>`.
- `/Users/joaosimi/Hat-Cross/node_modules/@tauri-apps/api/window.d.ts:1597` — `contentProtected?: boolean` on `WindowOptions`.
- `/Users/joaosimi/Hat-Cross/src-tauri/Cargo.toml` — `tauri = { version = "2", features = ["tray-icon", "macos-private-api"] }`, `objc2-app-kit 0.3` already vendored.
- `/Users/joaosimi/Hat-Cross/src-tauri/src/windows.rs:52-83` — popover + flash builder targets for `.content_protected(true)`.
- `/Users/joaosimi/Hat-Cross/src-tauri/capabilities/default.json` — capability file needing `core:window:allow-set-content-protected`.
- Tao upstream `src/platform_impl/macos/window.rs::set_content_protection` — confirmed NSWindowSharingType::None call.
- Tao upstream `src/platform_impl/windows/window.rs::set_content_protection` — confirmed SetWindowDisplayAffinity + WDA_EXCLUDEFROMCAPTURE call.
- Tao upstream `src/platform_impl/linux/window.rs` — confirmed no `set_content_protection` implementation (silent no-op).

---

## 11. Handoff checklist for FP2

- [ ] Add `content_protected(true)` to popover + flash builders in `windows.rs`.
- [ ] Add idempotent `set_content_protected(true)` reapply in `show_window`.
- [ ] Add JS reapply in FlashPage + PopoverPage mount `useEffect`.
- [ ] Add `core:window:allow-set-content-protected` permission to `capabilities/default.json`.
- [ ] Ship macOS 15+ limitation note in README under "Known issues".
- [ ] FP3 = the 10-run OBS/Zoom/Meet validation protocol (§7), scored in a table, committed under `docs/research/stealth-validation-YYYYMMDD.md`.

Word count: ~1950.
