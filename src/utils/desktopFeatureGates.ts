export function isWindowsDesktopPlatform(platform = navigator.platform): boolean {
  return /win/i.test(platform);
}

type MainWindowTauriGate = {
  isMainWindow: boolean;
  isTauri: boolean;
  isWindowsDesktop?: boolean;
};

export function canRegisterGlobalShortcuts({
  isMainWindow,
  isTauri,
}: MainWindowTauriGate): boolean {
  return isMainWindow && isTauri;
}

export function canProcessClipboardEvents({
  isMainWindow,
  isTauri,
}: MainWindowTauriGate): boolean {
  return isMainWindow && isTauri;
}
