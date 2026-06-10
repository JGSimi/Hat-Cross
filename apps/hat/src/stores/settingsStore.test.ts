import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockBridge, type MockBridge } from '../bridge/mock';
import type { SettingsPort } from '../bridge/settings';
import { defaultSettings } from '../domain/settings/schema';
import { useSettingsStore } from './settingsStore';

function fakePort(initial: unknown): SettingsPort & { saved: unknown[] } {
  const saved: unknown[] = [];
  return {
    saved,
    load: () => Promise.resolve(initial),
    save: (settings) => {
      saved.push(settings);
      return Promise.resolve();
    },
  };
}

describe('settingsStore', () => {
  let bridge: MockBridge;

  beforeEach(() => {
    // Reset do singleton entre testes.
    useSettingsStore.setState({ settings: defaultSettings, loaded: false });
    bridge = createMockBridge();
    document.documentElement.removeAttribute('data-theme');
  });

  it('init carrega, migra formato legado e aplica o tema ao DOM', async () => {
    const port = fakePort({
      theme: 'roxo',
      shortcuts: { clipboard: 'CommandOrControl+Shift+X' }, // chave legada
    });
    await useSettingsStore.getState().init({ port, bridge });

    const { settings, loaded } = useSettingsStore.getState();
    expect(loaded).toBe(true);
    expect(settings.theme).toBe('roxo');
    expect(settings.shortcuts.processClipboardFlash).toBe('CommandOrControl+Shift+X');
    expect(document.documentElement.getAttribute('data-theme')).toBe('roxo');
  });

  it('setTheme aplica ao DOM e persiste', async () => {
    const port = fakePort({});
    await useSettingsStore.getState().init({ port, bridge });
    await useSettingsStore.getState().setTheme('teal');

    expect(document.documentElement.getAttribute('data-theme')).toBe('teal');
    expect(useSettingsStore.getState().settings.theme).toBe('teal');
    expect(port.saved.at(-1)).toMatchObject({ theme: 'teal' });
  });

  it('setShortcut válido normaliza, re-registra no nativo e persiste', async () => {
    const port = fakePort({});
    await useSettingsStore.getState().init({ port, bridge });
    await useSettingsStore.getState().setShortcut('processClipboardFlash', 'cmd+shift+k');

    const { settings } = useSettingsStore.getState();
    expect(settings.shortcuts.processClipboardFlash).toBe('CommandOrControl+Shift+K');
    const setCalls = bridge.calls.filter((c) => c.method === 'setShortcuts');
    expect(setCalls).toHaveLength(1);
    expect(setCalls[0]?.args[0]).toMatchObject({
      processClipboardFlash: 'CommandOrControl+Shift+K',
    });
    expect(port.saved).toHaveLength(1);
  });

  it('setShortcut inválido lança e não toca nativo nem disco', async () => {
    const port = fakePort({});
    await useSettingsStore.getState().init({ port, bridge });
    const before = useSettingsStore.getState().settings.shortcuts;

    await expect(
      useSettingsStore.getState().setShortcut('emergencyQuit', 'Shift+'),
    ).rejects.toThrow(RangeError);

    expect(useSettingsStore.getState().settings.shortcuts).toEqual(before);
    expect(bridge.calls.some((c) => c.method === 'setShortcuts')).toBe(false);
    expect(port.saved).toHaveLength(0);
  });

  it('se o nativo rejeitar o rebind (conflito), nada é persistido', async () => {
    const port = fakePort({});
    await useSettingsStore.getState().init({ port, bridge });
    const before = useSettingsStore.getState().settings.shortcuts;
    bridge.setShortcuts = vi.fn(() => Promise.reject(new Error('conflict')));

    await expect(
      useSettingsStore.getState().setShortcut('processClipboardFlash', 'cmd+shift+j'),
    ).rejects.toThrow('conflict');

    expect(useSettingsStore.getState().settings.shortcuts).toEqual(before);
    expect(port.saved).toHaveLength(0);
  });
});
