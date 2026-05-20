import { describe, expect, it } from 'vitest';
import {
  canProcessClipboardEvents,
  canRebuildTrayMenu,
  canRegisterGlobalShortcuts,
  canRunStartupHydration,
  canListenTrayEvents,
  isWindowsDesktopPlatform,
  shouldPrewarmFlashOnStartup,
} from '../desktopFeatureGates';

describe('desktopFeatureGates', () => {
  it('detects Windows desktop platforms', () => {
    expect(isWindowsDesktopPlatform('Win32')).toBe(true);
    expect(isWindowsDesktopPlatform('MacIntel')).toBe(false);
  });

  it('keeps global shortcuts enabled for the main Tauri window on Windows', () => {
    expect(canRegisterGlobalShortcuts({
      isMainWindow: true,
      isTauri: true,
      isWindowsDesktop: true,
    })).toBe(true);
  });

  it('keeps clipboard processing enabled for the main Tauri window on Windows', () => {
    expect(canProcessClipboardEvents({
      isMainWindow: true,
      isTauri: true,
      isWindowsDesktop: true,
    })).toBe(true);
  });

  it('blocks desktop-only features outside the main Tauri window', () => {
    expect(canRegisterGlobalShortcuts({ isMainWindow: false, isTauri: true })).toBe(false);
    expect(canProcessClipboardEvents({ isMainWindow: true, isTauri: false })).toBe(false);
  });

  it('runs full startup hydration on Windows instead of forcing empty fallback state', () => {
    expect(canRunStartupHydration({ isTauri: true, isWindowsDesktop: true })).toBe(true);
    expect(canRunStartupHydration({ isTauri: true, isWindowsDesktop: false })).toBe(true);
    expect(canRunStartupHydration({ isTauri: false, isWindowsDesktop: true })).toBe(false);
  });

  it('keeps tray event listeners enabled on Windows while gating only dynamic menu mutation', () => {
    expect(canListenTrayEvents({ isTauri: true, isWindowsDesktop: true })).toBe(true);
    expect(canListenTrayEvents({ isTauri: false, isWindowsDesktop: true })).toBe(false);

    expect(canRebuildTrayMenu({ isTauri: true, isWindowsDesktop: true, bootReady: false })).toBe(false);
    expect(canRebuildTrayMenu({ isTauri: true, isWindowsDesktop: true, bootReady: true })).toBe(true);
  });

  it('does not prewarm flash windows during startup on any desktop platform', () => {
    expect(shouldPrewarmFlashOnStartup({ isMainWindow: true, isTauri: true, isWindowsDesktop: true })).toBe(false);
    expect(shouldPrewarmFlashOnStartup({ isMainWindow: true, isTauri: true, isWindowsDesktop: false })).toBe(false);
  });
});
