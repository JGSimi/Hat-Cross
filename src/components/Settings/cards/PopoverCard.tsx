import { MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import SettingsCard from './SettingsCard';
import { Section, Row, StackRow, Toggle, Slider, ShortcutRecorder } from './primitives';
import { useSettingsStore } from '../../../stores/settingsStore';

export default function PopoverCard() {
  const { settings, updateSettings } = useSettingsStore();
  const popover = settings.popover;
  const { t } = useTranslation('settings');

  const updatePopover = (partial: Partial<typeof popover>) => {
    updateSettings({ popover: { ...popover, ...partial } });
  };

  const preview = [
    popover.stealthMode ? t('popover.stealthOn') : t('popover.stealthOff'),
    popover.disguiseMode ? t('popover.disguiseOn') : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <SettingsCard
      title={t('popover.title')}
      icon={<MessageSquare size={14} strokeWidth={2} />}
      preview={preview}
    >
      <Section title={t('popover.shortcut')}>
        <Row label={t('popover.shortcutOpen')}>
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

      <Section title={t('popover.stealth')}>
        <Row label={t('popover.stealthEnable')}>
          <Toggle
            checked={popover.stealthMode}
            onChange={(v) => updatePopover({ stealthMode: v })}
          />
        </Row>
        {popover.stealthMode && (
          <StackRow
            label={t('popover.stealthHover')}
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

      <Section title={t('popover.disguise')}>
        <Row
          label={t('popover.disguiseShow')}
          hint={popover.disguiseMode ? t('popover.disguiseHint') : undefined}
        >
          <Toggle
            checked={popover.disguiseMode}
            onChange={(v) => updatePopover({ disguiseMode: v })}
          />
        </Row>
      </Section>

      <Section title={t('popover.size')}>
        <StackRow label={t('popover.width')} value={`${popover.width}px`}>
          <Slider
            min={300}
            max={800}
            step={10}
            value={popover.width}
            onChange={(v) => updatePopover({ width: v })}
          />
        </StackRow>
        <StackRow label={t('popover.height')} value={`${popover.height}px`}>
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
