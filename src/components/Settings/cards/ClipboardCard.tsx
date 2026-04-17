import { Clipboard } from 'lucide-react';
import SettingsCard from './SettingsCard';
import { SubHeading, SettingRow, Toggle, Slider, ShortcutRecorder } from './primitives';
import { useSettingsStore } from '../../../stores/settingsStore';

export default function ClipboardCard() {
  const { settings, updateSettings } = useSettingsStore();
  const clip = settings.clipboard;
  const update = (partial: Partial<typeof clip>) => {
    updateSettings({ clipboard: { ...clip, ...partial } });
  };

  // Count bool toggles (8 total: enabled, captureImages, copyResponseToClipboard,
  // appendMode, soundOnComplete, useCustomPrompt + maxResponseLength threshold
  // is NOT a toggle — so we track 6 toggles + 2 extra flags = display as N/6).
  const togglesActive =
    Number(clip.enabled) +
    Number(clip.captureImages) +
    Number(clip.copyResponseToClipboard) +
    Number(clip.appendMode) +
    Number(clip.soundOnComplete) +
    Number(clip.useCustomPrompt);
  const preview = `${togglesActive}/6 ativas`;

  return (
    <SettingsCard
      title="Clipboard"
      icon={<Clipboard size={14} strokeWidth={2} />}
      preview={preview}
    >
      <SubHeading>Atalho</SubHeading>
      <SettingRow label="Processar clipboard">
        <ShortcutRecorder
          value={settings.shortcuts.clipboard}
          onChange={(v) =>
            updateSettings({ shortcuts: { ...settings.shortcuts, clipboard: v } })
          }
        />
      </SettingRow>

      <SubHeading>Captura</SubHeading>
      <SettingRow label="Processamento ativo">
        <Toggle checked={clip.enabled} onChange={(v) => update({ enabled: v })} />
      </SettingRow>
      <SettingRow
        label="Capturar imagens do clipboard"
        hint={
          clip.captureImages
            ? 'Imagens copiadas (screenshots, prints) também são enviadas para a IA junto com o texto.'
            : undefined
        }
      >
        <Toggle
          checked={clip.captureImages}
          onChange={(v) => update({ captureImages: v })}
        />
      </SettingRow>
      <SettingRow label="Som ao completar">
        <Toggle
          checked={clip.soundOnComplete}
          onChange={(v) => update({ soundOnComplete: v })}
        />
      </SettingRow>

      <SubHeading>Resposta</SubHeading>
      <SettingRow label="Copiar resposta para o clipboard">
        <Toggle
          checked={clip.copyResponseToClipboard}
          onChange={(v) => update({ copyResponseToClipboard: v })}
        />
      </SettingRow>
      <SettingRow
        label="Modo anexar (original + resposta)"
        hint={
          clip.appendMode
            ? 'O texto original é mantido, com a resposta adicionada abaixo, separada por "---".'
            : undefined
        }
      >
        <Toggle
          checked={clip.appendMode}
          onChange={(v) => update({ appendMode: v })}
        />
      </SettingRow>
      <SettingRow label={`Tamanho máximo: ${clip.maxResponseLength} chars`}>
        <Slider
          min={256}
          max={16384}
          step={256}
          value={clip.maxResponseLength}
          onChange={(v) => update({ maxResponseLength: v })}
        />
      </SettingRow>

      <SubHeading>Prompt customizado</SubHeading>
      <SettingRow
        label="Usar prompt customizado"
        hint={
          clip.useCustomPrompt
            ? 'Este prompt será usado ao invés do prompt do sistema ao processar o clipboard.'
            : 'Quando desativado, usa o prompt do sistema (card "IA").'
        }
      >
        <Toggle
          checked={clip.useCustomPrompt}
          onChange={(v) => update({ useCustomPrompt: v })}
        />
      </SettingRow>
      {clip.useCustomPrompt && (
        <textarea
          value={clip.customPrompt}
          onChange={(e) => update({ customPrompt: e.target.value })}
          placeholder="Ex: Traduza para inglês. Responda apenas com a tradução, sem explicações."
          rows={3}
          style={{
            width: '100%',
            background: 'var(--input-bg)',
            color: 'var(--text-primary)',
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: 11,
            border: '0.5px solid var(--border-subtle)',
            resize: 'vertical',
            fontFamily: 'inherit',
            lineHeight: 1.5,
            marginTop: 8,
          }}
        />
      )}
    </SettingsCard>
  );
}
