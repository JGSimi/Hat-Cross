import { Clipboard } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import SettingsCard from './SettingsCard';
import { Row, Section, StackRow, Toggle, Slider, ShortcutRecorder } from './primitives';
import { useSettingsStore } from '../../../stores/settingsStore';

export default function ClipboardCard() {
  const { settings, updateSettings } = useSettingsStore();
  const clip = settings.clipboard;
  const { t, i18n } = useTranslation('settings');
  const update = (partial: Partial<typeof clip>) => {
    updateSettings({ clipboard: { ...clip, ...partial } });
  };

  const togglesActive =
    Number(clip.enabled) +
    Number(clip.captureImages) +
    Number(clip.copyResponseToClipboard) +
    Number(clip.appendMode) +
    Number(clip.soundOnComplete);
  const preview = t('clipboard.previewActive', { n: togglesActive });

  return (
    <SettingsCard
      title={t('clipboard.title')}
      icon={<Clipboard size={14} strokeWidth={2} />}
      preview={preview}
    >
      <Section title={t('clipboard.shortcut')}>
        <Row label={t('clipboard.shortcutProcess')}>
          <ShortcutRecorder
            value={settings.shortcuts.clipboard}
            onChange={(v) =>
              updateSettings({ shortcuts: { ...settings.shortcuts, clipboard: v } })
            }
          />
        </Row>
      </Section>

      <Section title={t('clipboard.capture')}>
        <Row label={t('clipboard.captureActive')}>
          <Toggle checked={clip.enabled} onChange={(v) => update({ enabled: v })} />
        </Row>
        <Row
          label={t('clipboard.captureImages')}
          hint={clip.captureImages ? t('clipboard.captureImagesHint') : undefined}
        >
          <Toggle
            checked={clip.captureImages}
            onChange={(v) => update({ captureImages: v })}
          />
        </Row>
        <Row label={t('clipboard.soundOnComplete')}>
          <Toggle
            checked={clip.soundOnComplete}
            onChange={(v) => update({ soundOnComplete: v })}
          />
        </Row>
      </Section>

      <Section title={t('clipboard.response')}>
        <Row label={t('clipboard.copyToClipboard')}>
          <Toggle
            checked={clip.copyResponseToClipboard}
            onChange={(v) => update({ copyResponseToClipboard: v })}
          />
        </Row>
        <Row
          label={t('clipboard.appendMode')}
          hint={clip.appendMode ? t('clipboard.appendModeHint') : undefined}
        >
          <Toggle
            checked={clip.appendMode}
            onChange={(v) => update({ appendMode: v })}
          />
        </Row>
        <StackRow
          label={t('clipboard.maxResponseLength')}
          value={`${clip.maxResponseLength.toLocaleString(i18n.language)} chars`}
        >
          <Slider
            min={256}
            max={16384}
            step={256}
            value={clip.maxResponseLength}
            onChange={(v) => update({ maxResponseLength: v })}
          />
        </StackRow>
      </Section>

    </SettingsCard>
  );
}
