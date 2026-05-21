import { Clipboard, CheckCircle2, Clock3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { RoomEntry } from '../../types/rooms';

interface Props {
  entries: RoomEntry[];
}

export default function RoomFeedPanel({ entries }: Props) {
  const { t, i18n } = useTranslation('rooms');
  const sorted = [...entries].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <section className="rooms-feed-panel">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <h2 style={{ margin: 0, color: 'var(--text-strong)', fontSize: 13 }}>
            {t('feed.title', { defaultValue: 'Clipboard da sala' })}
          </h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 11 }}>
            {t('feed.subtitle', { defaultValue: 'Tudo processado pelo Flash entra aqui.' })}
          </p>
        </div>
        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{sorted.length}</span>
      </div>

      {sorted.length === 0 ? (
        <div className="rooms-feed-empty">
          <Clipboard size={18} />
          <strong>{t('feed.emptyTitle', { defaultValue: 'Nada compartilhado ainda' })}</strong>
          <span>{t('feed.emptyBody', { defaultValue: 'Copie uma pergunta e use Cmd/Ctrl+Shift+F.' })}</span>
        </div>
      ) : (
        <div className="rooms-feed-list">
          {sorted.map((entry) => (
            <article key={entry.id} className="rooms-feed-entry">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 10 }}>
                  <Clock3 size={11} />
                  {new Intl.DateTimeFormat(i18n.language, {
                    hour: '2-digit',
                    minute: '2-digit',
                    day: '2-digit',
                    month: '2-digit',
                  }).format(entry.createdAt)}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--success)', fontSize: 10 }}>
                  <CheckCircle2 size={11} />
                  {Math.round(entry.confidence * 100)}%
                </span>
              </div>
              <p style={{ margin: '9px 0 0', color: 'var(--text-strong)', fontSize: 12, lineHeight: 1.35 }}>
                {entry.questionText}
              </p>
              <p style={{ margin: '8px 0 0', color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.45 }}>
                {entry.aiAnswer}
              </p>
              <div style={{ marginTop: 9, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span className="rooms-feed-chip">{entry.answerType}</span>
                <span className="rooms-feed-chip">{entry.mode}</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
