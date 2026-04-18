import { Zap } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import SettingsCard from './SettingsCard';
import { SubHeading, SettingRow, Toggle, Slider } from './primitives';
import { useSettingsStore } from '../../../stores/settingsStore';
import type { FlashTimingMode } from '../../../types';

const TIMING_MODES: { value: FlashTimingMode; label: string }[] = [
  { value: 'instant', label: 'Instant' },
  { value: 'fade', label: 'Fade' },
  { value: 'typewriter', label: 'Typewriter' },
];

export default function FlashCard() {
  const { settings, updateSettings } = useSettingsStore();
  const flash = settings.clipboard.flash;

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
      <SubHeading>Ativação</SubHeading>
      <SettingRow
        label="Flash Mode"
        hint={
          flash.enabled
            ? 'A resposta é "piscada" discretamente na posição abaixo em vez de abrir a notificação do sistema.'
            : undefined
        }
      >
        <Toggle checked={flash.enabled} onChange={(v) => update({ enabled: v })} />
      </SettingRow>

      <SubHeading>Conteúdo</SubHeading>
      <SettingRow label={`Prévia (${flash.previewLength} chars)`}>
        <Slider
          min={50}
          max={1000}
          step={10}
          value={flash.previewLength}
          onChange={(v) => update({ previewLength: v })}
        />
      </SettingRow>

      <SubHeading>Posição</SubHeading>
      <SettingRow
        label={`X: ${flash.position.x} · Y: ${flash.position.y}`}
        hint="Clique em Ajustar e arraste a janela até a posição ideal."
      >
        <button
          onClick={handleAdjustPosition}
          disabled={!flash.enabled}
          style={{
            background: flash.enabled
              ? 'var(--color-accent)'
              : 'var(--surface-secondary)',
            color: flash.enabled ? 'var(--bg-primary)' : 'var(--text-muted)',
            border: 'none',
            borderRadius: 6,
            padding: '5px 12px',
            fontSize: 10.5,
            fontWeight: 600,
            cursor: flash.enabled ? 'pointer' : 'not-allowed',
            opacity: flash.enabled ? 1 : 0.6,
          }}
        >
          Ajustar
        </button>
      </SettingRow>

      <SubHeading>Tempo</SubHeading>
      <SettingRow label="Modo">
        <div style={{ display: 'flex', gap: 4 }}>
          {TIMING_MODES.map((m) => {
            const active = flash.timing.mode === m.value;
            return (
              <button
                key={m.value}
                onClick={() => updateTiming({ mode: m.value })}
                style={{
                  background: active
                    ? 'var(--color-accent)'
                    : 'var(--surface-secondary)',
                  color: active ? 'var(--bg-primary)' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: 5,
                  padding: '3px 8px',
                  fontSize: 10,
                  fontWeight: active ? 600 : 400,
                  cursor: 'pointer',
                }}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </SettingRow>

      {flash.timing.mode === 'fade' && (
        <SettingRow label={`Fade in (${flash.timing.fadeInMs}ms)`}>
          <Slider
            min={50}
            max={1200}
            step={50}
            value={flash.timing.fadeInMs}
            onChange={(v) => updateTiming({ fadeInMs: v })}
          />
        </SettingRow>
      )}

      <SettingRow
        label={
          holdIsAuto
            ? 'Duração: automática'
            : `Duração (${flash.timing.holdMs ?? 4000}ms)`
        }
      >
        <Toggle
          checked={holdIsAuto}
          onChange={(v) => updateTiming({ holdMs: v ? null : 4000 })}
        />
      </SettingRow>
      {!holdIsAuto && (
        <SettingRow label="">
          <Slider
            min={500}
            max={15000}
            step={250}
            value={flash.timing.holdMs ?? 4000}
            onChange={(v) => updateTiming({ holdMs: v })}
          />
        </SettingRow>
      )}

      {flash.timing.mode !== 'instant' && (
        <SettingRow label={`Fade out (${flash.timing.fadeOutMs}ms)`}>
          <Slider
            min={50}
            max={1500}
            step={50}
            value={flash.timing.fadeOutMs}
            onChange={(v) => updateTiming({ fadeOutMs: v })}
          />
        </SettingRow>
      )}

      <SubHeading>Aparência</SubHeading>
      <SettingRow label="Cor">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="color"
            value={flash.appearance.color || '#A78BFA'}
            onChange={(e) => updateAppearance({ color: e.target.value })}
            style={{
              width: 28,
              height: 22,
              padding: 0,
              border: '1px solid var(--border-subtle)',
              borderRadius: 4,
              cursor: 'pointer',
              background: 'transparent',
            }}
          />
          <button
            onClick={() => updateAppearance({ color: '' })}
            title="Usar cor do tema atual"
            style={{
              background: 'transparent',
              color: 'var(--text-muted)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 4,
              padding: '2px 6px',
              fontSize: 9.5,
              cursor: 'pointer',
            }}
          >
            Tema
          </button>
        </div>
      </SettingRow>
      <SettingRow label={`Opacidade (${flash.appearance.opacity}%)`}>
        <Slider
          min={10}
          max={100}
          step={5}
          value={flash.appearance.opacity}
          onChange={(v) => updateAppearance({ opacity: v })}
        />
      </SettingRow>
      <SettingRow label={`Tamanho (${flash.appearance.fontSizePx}px)`}>
        <Slider
          min={10}
          max={32}
          step={1}
          value={flash.appearance.fontSizePx}
          onChange={(v) => updateAppearance({ fontSizePx: v })}
        />
      </SettingRow>
      <SettingRow
        label="Sombra para legibilidade"
        hint="Adiciona um contorno sutil para o texto não sumir em fundos claros."
      >
        <Toggle
          checked={flash.appearance.textShadow}
          onChange={(v) => updateAppearance({ textShadow: v })}
        />
      </SettingRow>
    </SettingsCard>
  );
}
