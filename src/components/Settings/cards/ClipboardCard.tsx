import { Clipboard } from 'lucide-react';
import SettingsCard from './SettingsCard';
import { Row, Section, StackRow, Toggle, Slider, ShortcutRecorder } from './primitives';
import { useSettingsStore } from '../../../stores/settingsStore';

export default function ClipboardCard() {
  const { settings, updateSettings } = useSettingsStore();
  const clip = settings.clipboard;
  const update = (partial: Partial<typeof clip>) => {
    updateSettings({ clipboard: { ...clip, ...partial } });
  };

  // Count bool toggles (6 main flags shown as N/6).
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
      <Section title="Atalho">
        <Row label="Processar clipboard">
          <ShortcutRecorder
            value={settings.shortcuts.clipboard}
            onChange={(v) =>
              updateSettings({ shortcuts: { ...settings.shortcuts, clipboard: v } })
            }
          />
        </Row>
      </Section>

      <Section title="Captura">
        <Row label="Processamento ativo">
          <Toggle checked={clip.enabled} onChange={(v) => update({ enabled: v })} />
        </Row>
        <Row
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
        </Row>
        <Row label="Som ao completar">
          <Toggle
            checked={clip.soundOnComplete}
            onChange={(v) => update({ soundOnComplete: v })}
          />
        </Row>
      </Section>

      <Section title="Resposta">
        <Row label="Copiar resposta para o clipboard">
          <Toggle
            checked={clip.copyResponseToClipboard}
            onChange={(v) => update({ copyResponseToClipboard: v })}
          />
        </Row>
        <Row
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
        </Row>
        <StackRow
          label="Tamanho máximo da resposta"
          value={`${clip.maxResponseLength.toLocaleString('pt-BR')} chars`}
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

      <Section title="Prompt customizado">
        <Row
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
        </Row>
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
      </Section>
    </SettingsCard>
  );
}
