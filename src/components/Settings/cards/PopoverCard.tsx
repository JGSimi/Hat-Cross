import { MessageSquare } from 'lucide-react';
import SettingsCard from './SettingsCard';
import { SubHeading, SettingRow, Toggle, Slider, ShortcutRecorder } from './primitives';
import { useSettingsStore } from '../../../stores/settingsStore';

export default function PopoverCard() {
  const { settings, updateSettings } = useSettingsStore();
  const popover = settings.popover;

  const updatePopover = (partial: Partial<typeof popover>) => {
    updateSettings({ popover: { ...popover, ...partial } });
  };

  const preview = [
    popover.stealthMode ? 'Stealth on' : 'Stealth off',
    popover.disguiseMode ? 'Disfarce on' : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <SettingsCard
      title="Popover"
      icon={<MessageSquare size={14} strokeWidth={2} />}
      preview={preview}
    >
      <SubHeading>Atalho</SubHeading>
      <SettingRow label="Abrir chat flutuante">
        <ShortcutRecorder
          value={settings.shortcuts.floatingChat}
          onChange={(v) =>
            updateSettings({
              shortcuts: { ...settings.shortcuts, floatingChat: v },
            })
          }
        />
      </SettingRow>

      <SubHeading>Modo furtivo</SubHeading>
      <SettingRow label="Ativar modo furtivo">
        <Toggle
          checked={popover.stealthMode}
          onChange={(v) => updatePopover({ stealthMode: v })}
        />
      </SettingRow>
      {popover.stealthMode && (
        <SettingRow
          label={`Opacidade ao passar o mouse (${Math.round(popover.stealthHoverOpacity * 100)}%)`}
        >
          <Slider
            min={0.1}
            max={1}
            step={0.05}
            value={popover.stealthHoverOpacity}
            onChange={(v) => updatePopover({ stealthHoverOpacity: v })}
          />
        </SettingRow>
      )}

      <SubHeading>Disfarce</SubHeading>
      <SettingRow
        label="Mostrar relógio como disfarce"
        hint={
          popover.disguiseMode
            ? 'O chat aparece como um widget de relógio. Clique no relógio para revelar.'
            : undefined
        }
      >
        <Toggle
          checked={popover.disguiseMode}
          onChange={(v) => updatePopover({ disguiseMode: v })}
        />
      </SettingRow>

      <SubHeading>Tamanho</SubHeading>
      <SettingRow label={`Largura (${popover.width}px)`}>
        <Slider
          min={300}
          max={800}
          step={10}
          value={popover.width}
          onChange={(v) => updatePopover({ width: v })}
        />
      </SettingRow>
      <SettingRow label={`Altura (${popover.height}px)`}>
        <Slider
          min={350}
          max={900}
          step={10}
          value={popover.height}
          onChange={(v) => updatePopover({ height: v })}
        />
      </SettingRow>
    </SettingsCard>
  );
}
