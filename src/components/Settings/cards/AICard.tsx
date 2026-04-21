import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import SettingsCard from './SettingsCard';
import { Row, Section, StackRow, Slider, Toggle } from './primitives';
import { useSettingsStore } from '../../../stores/settingsStore';

export default function AICard() {
  const { settings, updateSettings } = useSettingsStore();
  const { t, i18n } = useTranslation('settings');
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

  const preview = t('ai.previewTokens', { temp: settings.temperature.toFixed(1), tokens: tokensPreview });

  return (
    <SettingsCard
      title={t('ai.title')}
      icon={<Sparkles size={14} strokeWidth={2} />}
      preview={preview}
    >
      <Section title={t('ai.systemPrompt')}>
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
      </Section>

      <Section title={t('ai.parameters')}>
        <StackRow label={t('ai.temperature')} value={settings.temperature.toFixed(1)}>
          <Slider
            min={0}
            max={2}
            step={0.1}
            value={settings.temperature}
            onChange={(v) => updateSettings({ temperature: v })}
          />
        </StackRow>
        <StackRow label={t('ai.maxTokens')} value={settings.maxTokens.toLocaleString(i18n.language)}>
          <Slider
            min={256}
            max={32768}
            step={256}
            value={settings.maxTokens}
            onChange={(v) => updateSettings({ maxTokens: v })}
          />
        </StackRow>
      </Section>

      <Section title={t('ai.chatLimits')}>
        <StackRow
          label={t('ai.context')}
          value={t('ai.contextUnit', { count: limits.maxContextMessages })}
          hint={t('ai.contextHint')}
        >
          <Slider
            min={10}
            max={100}
            step={2}
            value={limits.maxContextMessages}
            onChange={(v) => updateLimits({ maxContextMessages: v })}
          />
        </StackRow>
        <Row label={t('ai.autoNewChat')}>
          <Toggle
            checked={limits.autoNewChatOnLimit}
            onChange={(v) => updateLimits({ autoNewChatOnLimit: v })}
          />
        </Row>
        <StackRow label={t('ai.maxConversations')} value={String(limits.maxConversations)}>
          <Slider
            min={10}
            max={200}
            step={10}
            value={limits.maxConversations}
            onChange={(v) => updateLimits({ maxConversations: v })}
          />
        </StackRow>
        <StackRow
          label={t('ai.maxMessagesPerConversation')}
          value={String(limits.maxMessagesPerConversation)}
          hint={t('ai.maxMessagesHint')}
        >
          <Slider
            min={50}
            max={500}
            step={10}
            value={limits.maxMessagesPerConversation}
            onChange={(v) => updateLimits({ maxMessagesPerConversation: v })}
          />
        </StackRow>
      </Section>
    </SettingsCard>
  );
}
