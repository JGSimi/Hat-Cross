import { Zap } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import SettingsCard from './SettingsCard';
import { Row, Section, StackRow, Toggle, Slider, PillGroup, ShortcutRecorder } from './primitives';
import { useSettingsStore } from '../../../stores/settingsStore';
import type { FlashTimingMode } from '../../../types';

const TIMING_OPTIONS: { value: FlashTimingMode; label: string }[] = [
  { value: 'instant', label: 'Instant' },
  { value: 'fade', label: 'Fade' },
  { value: 'typewriter', label: 'Typewriter' },
];

export default function FlashCard() {
  const { settings, updateSettings } = useSettingsStore();
  const flash = settings.clipboard.flash;

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
    // The global listener in App.tsx persists the new position once the user
    // hits Save in the flash window — no local listener needed here.
    invoke('flash_enter_adjust_mode', {
      position: { x: flash.position.x, y: flash.position.y },
    }).catch((e) => console.error('[flash] enter adjust failed:', e));
  };

  const preview = flash.enabled ? 'Ativo' : 'Desativado';
  const holdIsAuto = flash.timing.holdMs === null;

  return (
    <SettingsCard
      title="Flash Mode"
      icon={<Zap size={14} strokeWidth={2} />}
      preview={preview}
    >
      <Section title="Atalho">
        <Row label="Ajustar posição do flash">
          <ShortcutRecorder
            value={settings.shortcuts.adjustFlashPosition}
            onChange={updateShortcut}
          />
        </Row>
      </Section>

      <Section title="Ativação">
        <Row
          label="Flash Mode"
          hint={
            flash.enabled
              ? 'A resposta é "piscada" discretamente na posição abaixo em vez de abrir a notificação do sistema.'
              : undefined
          }
        >
          <Toggle checked={flash.enabled} onChange={(v) => update({ enabled: v })} />
        </Row>
      </Section>

      <Section title="Conteúdo">
        <StackRow label="Prévia" value={`${flash.previewLength} chars`}>
          <Slider
            min={50}
            max={1000}
            step={10}
            value={flash.previewLength}
            onChange={(v) => update({ previewLength: v })}
          />
        </StackRow>
      </Section>

      <Section title="Posição">
        <Row
          label={`X: ${flash.position.x} · Y: ${flash.position.y}`}
          hint="Clique em Ajustar e arraste a janela até a posição ideal."
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
            Ajustar
          </button>
        </Row>
      </Section>

      <Section title="Tempo">
        <Row label="Modo">
          <PillGroup<FlashTimingMode>
            options={TIMING_OPTIONS}
            value={flash.timing.mode}
            onChange={(v) => updateTiming({ mode: v })}
            size="sm"
          />
        </Row>
        {flash.timing.mode === 'fade' && (
          <StackRow label="Fade in" value={`${flash.timing.fadeInMs}ms`}>
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
          label={holdIsAuto ? 'Duração automática' : 'Duração fixa'}
          hint={holdIsAuto ? 'O tempo adapta ao tamanho da resposta.' : undefined}
        >
          <Toggle
            checked={holdIsAuto}
            onChange={(v) => updateTiming({ holdMs: v ? null : 4000 })}
          />
        </Row>
        {!holdIsAuto && (
          <StackRow label="Duração" value={`${flash.timing.holdMs ?? 4000}ms`}>
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
          <StackRow label="Fade out" value={`${flash.timing.fadeOutMs}ms`}>
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

      <Section title="Aparência">
        <Row label="Cor">
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
              title="Escolher cor"
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
              title="Usar cor do tema atual"
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
              Tema
            </button>
          </div>
        </Row>
        <StackRow label="Opacidade" value={`${flash.appearance.opacity}%`}>
          <Slider
            min={10}
            max={100}
            step={5}
            value={flash.appearance.opacity}
            onChange={(v) => updateAppearance({ opacity: v })}
          />
        </StackRow>
        <StackRow label="Tamanho" value={`${flash.appearance.fontSizePx}px`}>
          <Slider
            min={10}
            max={32}
            step={1}
            value={flash.appearance.fontSizePx}
            onChange={(v) => updateAppearance({ fontSizePx: v })}
          />
        </StackRow>
        <Row
          label="Sombra para legibilidade"
          hint="Adiciona um contorno sutil para o texto não sumir em fundos claros."
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
