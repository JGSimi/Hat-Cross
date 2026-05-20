import { describe, expect, it } from 'vitest';
import {
  canProcessClipboardEvents,
  canRegisterGlobalShortcuts,
  isWindowsDesktopPlatform,
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
});
