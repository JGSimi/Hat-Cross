// Formats an accelerator string for display.
// macOS uses symbols (⌘, ⇧, ⌥, ⌃); Windows/Linux use text (Ctrl, Shift, Alt).
// Accepts both `CommandOrControl+X` (Tauri canonical) and legacy `CmdOrCtrl+X`.

export type Platform = 'macos' | 'windows' | 'linux';

export function formatShortcut(accel: string, platform: Platform): string {
  if (!accel) return '';

  if (platform === 'macos') {
    return accel
      .replace(/CommandOrControl\+/g, '⌘+')
      .replace(/CmdOrCtrl\+/g, '⌘+')
      .replace(/Command\+/g, '⌘+')
      .replace(/Meta\+/g, '⌘+')
      .replace(/Control\+/g, '⌃+')
      .replace(/Ctrl\+/g, '⌃+')
      .replace(/Shift\+/g, '⇧+')
      .replace(/Alt\+/g, '⌥+')
      .replace(/Option\+/g, '⌥+');
  }

  return accel
    .replace(/CommandOrControl\+/g, 'Ctrl+')
    .replace(/CmdOrCtrl\+/g, 'Ctrl+')
    .replace(/Command\+/g, 'Win+')
    .replace(/Meta\+/g, 'Win+');
}
