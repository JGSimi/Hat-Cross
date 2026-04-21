import { Bell } from 'lucide-react';
import SettingsCard from './SettingsCard';
import { Row, Section, Toggle } from './primitives';
import { useSettingsStore } from '../../../stores/settingsStore';

export default function NotificationsCard() {
  const { settings, updateSettings } = useSettingsStore();
  const notif = settings.notifications;

  const update = (partial: Partial<typeof notif>) => {
    updateSettings({ notifications: { ...notif, ...partial } });
  };

  const activeCount = notif.enabled
    ? [
        notif.showProcessingNotification,
        notif.showResponseNotification,
        notif.showChatResponseNotification,
        notif.showErrorNotification,
        notif.showClipboardEmptyNotification,
        notif.showUpdateNotification,
      ].filter(Boolean).length
    : 0;

  const preview = notif.enabled ? `${activeCount} ativas` : 'desativadas';

  return (
    <SettingsCard
      title="Notificações"
      icon={<Bell size={14} strokeWidth={2} />}
      preview={preview}
    >
      <Section>
        <Row label="Notificações ativas">
          <Toggle checked={notif.enabled} onChange={(v) => update({ enabled: v })} />
        </Row>
      </Section>

      <Section
        title="Tipos"
        meta={notif.enabled ? `${activeCount}/6` : undefined}
      >
        <div
          style={{
            opacity: notif.enabled ? 1 : 0.4,
            pointerEvents: notif.enabled ? 'auto' : 'none',
            transition: 'opacity 0.2s ease',
          }}
        >
          <Row label="Processamento do clipboard">
            <Toggle
              checked={notif.showProcessingNotification}
              onChange={(v) => update({ showProcessingNotification: v })}
              disabled={!notif.enabled}
            />
          </Row>
          <Row label="Resposta do clipboard">
            <Toggle
              checked={notif.showResponseNotification}
              onChange={(v) => update({ showResponseNotification: v })}
              disabled={!notif.enabled}
            />
          </Row>
          <Row label="Resposta de chat (sem foco)">
            <Toggle
              checked={notif.showChatResponseNotification}
              onChange={(v) => update({ showChatResponseNotification: v })}
              disabled={!notif.enabled}
            />
          </Row>
          <Row label="Erros">
            <Toggle
              checked={notif.showErrorNotification}
              onChange={(v) => update({ showErrorNotification: v })}
              disabled={!notif.enabled}
            />
          </Row>
          <Row label="Clipboard vazio">
            <Toggle
              checked={notif.showClipboardEmptyNotification}
              onChange={(v) => update({ showClipboardEmptyNotification: v })}
              disabled={!notif.enabled}
            />
          </Row>
          <Row label="Atualizações">
            <Toggle
              checked={notif.showUpdateNotification}
              onChange={(v) => update({ showUpdateNotification: v })}
              disabled={!notif.enabled}
            />
          </Row>
        </div>
      </Section>

      <p
        style={{
          fontSize: 10,
          color: 'var(--text-muted)',
          margin: '14px 0 0',
          lineHeight: 1.5,
        }}
      >
        O tempo de exibição é controlado pelo sistema operacional.
      </p>
    </SettingsCard>
  );
}
