import { Zap } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';
import SettingsCard from './SettingsCard';
import { Row, Section, StackRow, Toggle, Slider, PillGroup, ShortcutRecorder } from './primitives';
import { useSettingsStore } from '../../../stores/settingsStore';
import type { FlashTimingMode } from '../../../types';

export default function FlashCard() {
  const { settings, updateSettings } = useSettingsStore();
  const flash = settings.clipboard.flash;
  const { t } = useTranslation('settings');

  const TIMING_OPTIONS: { value: FlashTimingMode; label: string }[] = [
    { value: 'instant', label: t('flash.timingInstant') },
    { value: 'fade', label: t('flash.timingFade') },
    { value: 'typewriter', label: t('flash.timingTypewriter') },
  ];

  const updateShortcut = (v: string) =>
    updateSettings({
      shortcuts: { ...settings.shortcuts, adjustFlashPosition: v },
    });

  const update = (partial: Partial<typeof flash>) => {
    updateSettings({
      clipboard: {
        ...settings.clipboard,
        flash: { ...flash, ...partial },
      },
    });
  };

  const updateTiming = (partial: Partial<typeof flash.timing>) => {
    update({ timing: { ...flash.timing, ...partial } });
  };

  const updateAppearance = (partial: Partial<typeof flash.appearance>) => {
    update({ appearance: { ...flash.appearance, ...partial } });
  };

  const handleAdjustPosition = () => {
    invoke('flash_enter_adjust_mode', {
      position: { x: flash.position.x, y: flash.position.y },
    }).catch((e) => console.error('[flash] enter adjust failed:', e));
  };

  const preview = flash.enabled ? t('flash.previewOn') : t('flash.previewOff');
  const holdIsAuto = flash.timing.holdMs === null;

  return (
    <SettingsCard
      title={t('flash.title')}
      icon={<Zap size={14} strokeWidth={2} />}
      preview={preview}
    >
      <Section title={t('flash.shortcut')}>
        <Row label={t('flash.shortcutAdjust')}>
          <ShortcutRecorder
            value={settings.shortcuts.adjustFlashPosition}
            onChange={updateShortcut}
          />
        </Row>
      </Section>

      <Section title={t('flash.activation')}>
        <Row
          label={t('flash.flashMode')}
          hint={flash.enabled ? t('flash.flashModeHint') : undefined}
        >
          <Toggle checked={flash.enabled} onChange={(v) => update({ enabled: v })} />
        </Row>
      </Section>

      <Section title={t('flash.content')}>
        <StackRow label={t('flash.preview')} value={`${flash.previewLength} chars`}>
          <Slider
            min={50}
            max={1000}
            step={10}
            value={flash.previewLength}
            onChange={(v) => update({ previewLength: v })}
          />
        </StackRow>
      </Section>

      <Section title={t('flash.position')}>
        <Row
          label={`X: ${flash.position.x} · Y: ${flash.position.y}`}
          hint={t('flash.positionHint')}
        >
          <button
            onClick={handleAdjustPosition}
            disabled={!flash.enabled}
            className="settings-action-btn"
            style={{
              background: flash.enabled
                ? 'var(--color-accent)'
                : 'var(--surface-secondary)',
              color: flash.enabled ? 'var(--bg-primary)' : 'var(--text-muted)',
              border: 'none',
              borderRadius: 7,
              padding: '5px 12px',
              fontSize: 10.5,
              fontWeight: 600,
              cursor: flash.enabled ? 'pointer' : 'not-allowed',
              opacity: flash.enabled ? 1 : 0.6,
            }}
          >
            {t('flash.adjust')}
          </button>
        </Row>
      </Section>

      <Section title={t('flash.timing')}>
        <Row label={t('flash.timingMode')}>
          <PillGroup<FlashTimingMode>
            options={TIMING_OPTIONS}
            value={flash.timing.mode}
            onChange={(v) => updateTiming({ mode: v })}
            size="sm"
          />
        </Row>
        {flash.timing.mode === 'fade' && (
          <StackRow label={t('flash.fadeIn')} value={`${flash.timing.fadeInMs}ms`}>
            <Slider
              min={50}
              max={1200}
              step={50}
              value={flash.timing.fadeInMs}
              onChange={(v) => updateTiming({ fadeInMs: v })}
            />
          </StackRow>
        )}
        <Row
          label={holdIsAuto ? t('flash.durationAuto') : t('flash.durationFixed')}
          hint={holdIsAuto ? t('flash.durationAutoHint') : undefined}
        >
          <Toggle
            checked={holdIsAuto}
            onChange={(v) => updateTiming({ holdMs: v ? null : 4000 })}
          />
        </Row>
        {!holdIsAuto && (
          <StackRow label={t('flash.duration')} value={`${flash.timing.holdMs ?? 4000}ms`}>
            <Slider
              min={500}
              max={15000}
              step={250}
              value={flash.timing.holdMs ?? 4000}
              onChange={(v) => updateTiming({ holdMs: v })}
            />
          </StackRow>
        )}
        {flash.timing.mode !== 'instant' && (
          <StackRow label={t('flash.fadeOut')} value={`${flash.timing.fadeOutMs}ms`}>
            <Slider
              min={50}
              max={1500}
              step={50}
              value={flash.timing.fadeOutMs}
              onChange={(v) => updateTiming({ fadeOutMs: v })}
            />
          </StackRow>
        )}
      </Section>

      <Section title={t('flash.appearance')}>
        <Row label={t('flash.color')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label
              style={{
                position: 'relative',
                width: 26,
                height: 26,
                borderRadius: 8,
                border: '0.5px solid var(--border-subtle)',
                background: flash.appearance.color || 'var(--color-accent)',
                cursor: 'pointer',
                display: 'inline-flex',
                overflow: 'hidden',
                boxShadow: 'inset 0 0 0 0.5px rgba(255,255,255,0.08)',
              }}
              title={t('flash.colorPick')}
            >
              <input
                type="color"
                value={flash.appearance.color || '#A78BFA'}
                onChange={(e) => updateAppearance({ color: e.target.value })}
                style={{
                  position: 'absolute',
                  inset: 0,
                  opacity: 0,
                  cursor: 'pointer',
                  border: 'none',
                  background: 'transparent',
                }}
              />
            </label>
            <button
              onClick={() => updateAppearance({ color: '' })}
              title={t('flash.colorUseTheme')}
              style={{
                background: flash.appearance.color ? 'transparent' : 'var(--surface-elevated)',
                color: flash.appearance.color ? 'var(--text-muted)' : 'var(--text-bright)',
                border: '0.5px solid var(--border-subtle)',
                borderRadius: 6,
                padding: '4px 10px',
                fontSize: 10,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {t('flash.colorThemeLabel')}
            </button>
          </div>
        </Row>
        <StackRow label={t('flash.opacity')} value={`${flash.appearance.opacity}%`}>
          <Slider
            min={10}
            max={100}
            step={5}
            value={flash.appearance.opacity}
            onChange={(v) => updateAppearance({ opacity: v })}
          />
        </StackRow>
        <StackRow label={t('flash.fontSize')} value={`${flash.appearance.fontSizePx}px`}>
          <Slider
            min={10}
            max={32}
            step={1}
            value={flash.appearance.fontSizePx}
            onChange={(v) => updateAppearance({ fontSizePx: v })}
          />
        </StackRow>
        <Row
          label={t('flash.textShadow')}
          hint={t('flash.textShadowHint')}
        >
          <Toggle
            checked={flash.appearance.textShadow}
            onChange={(v) => updateAppearance({ textShadow: v })}
          />
        </Row>
      </Section>
    </SettingsCard>
  );
}
