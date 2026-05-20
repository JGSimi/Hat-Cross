export function isWindowsDesktopPlatform(platform = navigator.platform): boolean {
  return /win/i.test(platform);
}

type MainWindowTauriGate = {
  isMainWindow: boolean;
  isTauri: boolean;
  isWindowsDesktop?: boolean;
};

type TauriGate = {
  isTauri: boolean;
  isWindowsDesktop?: boolean;
};

type TrayRebuildGate = TauriGate & {
  bootReady: boolean;
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

export function canRunStartupHydration({ isTauri }: TauriGate): boolean {
  return isTauri;
}

export function canListenTrayEvents({ isTauri }: TauriGate): boolean {
  return isTauri;
}

export function canRebuildTrayMenu({ isTauri, bootReady }: TrayRebuildGate): boolean {
  return isTauri && bootReady;
}

export function shouldPrewarmFlashOnStartup(_gate: MainWindowTauriGate): boolean {
  return false;
}
