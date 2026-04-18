import { Keyboard } from 'lucide-react';
import SettingsCard from './SettingsCard';
import { SettingRow, ShortcutRecorder } from './primitives';
import { useSettingsStore } from '../../../stores/settingsStore';

export default function ShortcutsCard() {
  const { settings, updateSettings } = useSettingsStore();

  // Preview counts how many non-empty shortcuts are configured.
  // floatingChat is edited in the Popover card (avoids duplication), but we
  // still count it here since it's a global shortcut.
  const shortcutCount = [
    settings.shortcuts.clipboard,
    settings.shortcuts.floatingChat,
    settings.shortcuts.adjustFlashPosition,
    settings.shortcuts.emergencyQuit,
  ].filter((s) => s && s.trim().length > 0).length;
  const preview = `${shortcutCount} definidos`;

  return (
    <SettingsCard
      title="Atalhos"
      icon={<Keyboard size={14} strokeWidth={2} />}
      preview={preview}
    >
      <SettingRow label="Processar clipboard">
        <ShortcutRecorder
          value={settings.shortcuts.clipboard}
          onChange={(v) =>
            updateSettings({ shortcuts: { ...settings.shortcuts, clipboard: v } })
          }
        />
      </SettingRow>
      <SettingRow label="Ajustar posição do flash">
        <ShortcutRecorder
          value={settings.shortcuts.adjustFlashPosition}
          onChange={(v) =>
            updateSettings({
              shortcuts: { ...settings.shortcuts, adjustFlashPosition: v },
            })
          }
        />
      </SettingRow>
      <SettingRow
        label="Fechar em emergência"
        hint="Fecha o Hat completamente mesmo sem ele estar em foco. Útil se algo travar ou se precisar esconder o app rapidamente."
      >
        <ShortcutRecorder
          value={settings.shortcuts.emergencyQuit}
          onChange={(v) =>
            updateSettings({
              shortcuts: { ...settings.shortcuts, emergencyQuit: v },
            })
          }
        />
      </SettingRow>

      <p
        style={{
          fontSize: 10,
          color: 'var(--text-muted)',
          margin: '12px 0 4px',
          lineHeight: 1.5,
        }}
      >
        Clique num atalho e pressione a nova combinação de teclas. Esc para cancelar, Backspace para limpar.
      </p>
      <p
        style={{
          fontSize: 10,
          color: 'var(--text-muted)',
          margin: '6px 0 0',
          lineHeight: 1.5,
        }}
      >
        Chat flutuante: configure no card <strong style={{ color: 'var(--text-secondary)' }}>Popover</strong>.
      </p>
    </SettingsCard>
  );
}
