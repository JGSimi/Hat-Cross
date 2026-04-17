import { Sparkles } from 'lucide-react';
import SettingsCard from './SettingsCard';
import { SubHeading, SettingRow, Toggle, Slider } from './primitives';
import { useSettingsStore } from '../../../stores/settingsStore';

export default function AICard() {
  const { settings, updateSettings } = useSettingsStore();
  const limits = settings.chatLimits ?? {
    maxContextMessages: 40,
    maxConversations: 50,
    maxMessagesPerConversation: 200,
    autoNewChatOnLimit: true,
  };
  const updateLimits = (partial: Partial<typeof limits>) => {
    updateSettings({ chatLimits: { ...limits, ...partial } });
  };

  const tokensPreview = settings.maxTokens >= 1000
    ? `${Math.round(settings.maxTokens / 1024)}k`
    : `${settings.maxTokens}`;

  const preview = `temp ${settings.temperature.toFixed(1)} · ${tokensPreview} tokens`;

  return (
    <SettingsCard
      title="IA"
      icon={<Sparkles size={14} strokeWidth={2} />}
      preview={preview}
    >
      <SubHeading>Prompt do sistema</SubHeading>
      <textarea
        value={settings.systemPrompt}
        onChange={(e) => updateSettings({ systemPrompt: e.target.value })}
        rows={6}
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
        }}
      />

      <SubHeading>Parâmetros</SubHeading>
      <SettingRow label={`Temperatura: ${settings.temperature.toFixed(1)}`}>
        <Slider
          min={0}
          max={2}
          step={0.1}
          value={settings.temperature}
          onChange={(v) => updateSettings({ temperature: v })}
        />
      </SettingRow>
      <SettingRow label={`Máximo de tokens: ${settings.maxTokens}`}>
        <Slider
          min={256}
          max={32768}
          step={256}
          value={settings.maxTokens}
          onChange={(v) => updateSettings({ maxTokens: v })}
        />
      </SettingRow>

      <SubHeading>Limites da conversa</SubHeading>
      <SettingRow
        label={`Contexto da IA: ${limits.maxContextMessages} msgs`}
        hint="Quantidade de mensagens enviadas como contexto. Valores menores economizam tokens e mantêm respostas mais focadas."
      >
        <Slider
          min={10}
          max={100}
          step={2}
          value={limits.maxContextMessages}
          onChange={(v) => updateLimits({ maxContextMessages: v })}
        />
      </SettingRow>
      <SettingRow label="Nova conversa automática ao atingir limite">
        <Toggle
          checked={limits.autoNewChatOnLimit}
          onChange={(v) => updateLimits({ autoNewChatOnLimit: v })}
        />
      </SettingRow>
      <SettingRow label={`Máx. conversas: ${limits.maxConversations}`}>
        <Slider
          min={10}
          max={200}
          step={10}
          value={limits.maxConversations}
          onChange={(v) => updateLimits({ maxConversations: v })}
        />
      </SettingRow>
      <SettingRow
        label={`Máx. msgs/conversa: ${limits.maxMessagesPerConversation}`}
        hint="Conversas antigas (não fixadas) são removidas ao ultrapassar o limite. Valores altos podem causar lentidão."
      >
        <Slider
          min={50}
          max={500}
          step={10}
          value={limits.maxMessagesPerConversation}
          onChange={(v) => updateLimits({ maxMessagesPerConversation: v })}
        />
      </SettingRow>
    </SettingsCard>
  );
}
