import { MessageSquare } from 'lucide-react';
import SettingsCard from './SettingsCard';
import { Section, Row, StackRow, Toggle, Slider, ShortcutRecorder } from './primitives';
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
      <Section title="Atalho">
        <Row label="Abrir chat flutuante">
          <ShortcutRecorder
            value={settings.shortcuts.floatingChat}
            onChange={(v) =>
              updateSettings({
                shortcuts: { ...settings.shortcuts, floatingChat: v },
              })
            }
          />
        </Row>
      </Section>

      <Section title="Modo furtivo">
        <Row label="Ativar modo furtivo">
          <Toggle
            checked={popover.stealthMode}
            onChange={(v) => updatePopover({ stealthMode: v })}
          />
        </Row>
        {popover.stealthMode && (
          <StackRow
            label="Opacidade ao passar o mouse"
            value={`${Math.round(popover.stealthHoverOpacity * 100)}%`}
          >
            <Slider
              min={0.1}
              max={1}
              step={0.05}
              value={popover.stealthHoverOpacity}
              onChange={(v) => updatePopover({ stealthHoverOpacity: v })}
            />
          </StackRow>
        )}
      </Section>

      <Section title="Disfarce">
        <Row
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
        </Row>
      </Section>

      <Section title="Tamanho">
        <StackRow label="Largura" value={`${popover.width}px`}>
          <Slider
            min={300}
            max={800}
            step={10}
            value={popover.width}
            onChange={(v) => updatePopover({ width: v })}
          />
        </StackRow>
        <StackRow label="Altura" value={`${popover.height}px`}>
          <Slider
            min={350}
            max={900}
            step={10}
            value={popover.height}
            onChange={(v) => updatePopover({ height: v })}
          />
        </StackRow>
      </Section>
    </SettingsCard>
  );
}
