import { CheckCircle2, GitCompareArrows } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { RoomCluster, RoomEntry } from '../../types/rooms';

interface Props {
  clusters: RoomCluster[];
  entries: RoomEntry[];
}

export default function RoomConsensusPanel({ clusters, entries }: Props) {
  const { t } = useTranslation('rooms');
  const entriesById = new Map(entries.map((entry) => [entry.id, entry]));

  return (
    <section style={{ display: 'grid', gap: 10, minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <h2 style={{ margin: 0, color: 'var(--text-strong)', fontSize: 13 }}>
          {t('consensus.title')}
        </h2>
        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{clusters.length}</span>
      </div>

      {clusters.length === 0 ? (
        <div style={emptyStyle}>
          <GitCompareArrows size={18} />
          <strong>{t('consensus.emptyTitle')}</strong>
          <span>{t('consensus.emptyBody')}</span>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8, overflowY: 'auto', minHeight: 0 }}>
          {clusters.map((cluster) => {
            const divergent = cluster.divergentEntryIds
              .map((id) => entriesById.get(id))
              .filter((entry): entry is RoomEntry => Boolean(entry));
            return (
              <article key={cluster.id} style={clusterStyle}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <CheckCircle2 size={15} style={{ color: divergent.length ? 'var(--warning)' : 'var(--success)', flexShrink: 0, marginTop: 1 }} />
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, color: 'var(--text-strong)', fontSize: 12, lineHeight: 1.35 }}>
                      {cluster.canonicalQuestion}
                    </p>
                    <p style={{ margin: '7px 0 0', color: 'var(--text-secondary)', fontSize: 12 }}>
                      {t('consensus.answer')}: <strong>{String(cluster.consensusAnswer ?? t('consensus.pending'))}</strong>
                    </p>
                    <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 10 }}>
                      {Math.round(cluster.consensusConfidence * 100)}% · {cluster.entryIds.length} {t('consensus.entries')}
                    </p>
                  </div>
                </div>
                {divergent.length > 0 && (
                  <div style={divergenceStyle}>
                    {t('consensus.divergent', { count: divergent.length })}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

const emptyStyle: React.CSSProperties = {
  minHeight: 150,
  borderRadius: 8,
  border: '1px dashed var(--border-subtle)',
  display: 'grid',
  placeItems: 'center',
  gap: 6,
  padding: 18,
  color: 'var(--text-muted)',
  textAlign: 'center',
  fontSize: 12,
};

const clusterStyle: React.CSSProperties = {
  border: '1px solid var(--border-subtle)',
  background: 'var(--glass-secondary)',
  borderRadius: 8,
  padding: 12,
};

const divergenceStyle: React.CSSProperties = {
  marginTop: 10,
  padding: '7px 8px',
  borderRadius: 6,
  color: 'var(--warning)',
  background: 'color-mix(in srgb, var(--warning) 10%, transparent)',
  fontSize: 11,
};
