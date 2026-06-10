import type { RoomEntry } from '../../domain/rooms/types';

interface RoomEntriesFeedProps {
  entries: RoomEntry[];
  myUid: string;
}

const timeFormat = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
});

function shortUid(uid: string): string {
  return uid.replace(/^demo-/, '').slice(0, 8);
}

/**
 * Feed cronológico das perguntas da sala. Minhas entries levam um fio de
 * accent na borda esquerda; a resposta extraída vai em pílula mono.
 */
export function RoomEntriesFeed({ entries, myUid }: RoomEntriesFeedProps) {
  if (entries.length === 0) {
    return (
      <p className="m-0 px-1 py-10 text-center text-[12px] text-text-muted" data-testid="entries-empty">
        Nenhuma pergunta compartilhada ainda.
      </p>
    );
  }

  return (
    <ol className="m-0 flex list-none flex-col p-0" data-testid="entries-feed">
      {entries.map((entry, i) => {
        const mine = entry.uid === myUid;
        return (
          <li
            key={entry.id}
            className="hat-rise border-0 border-b border-solid border-b-hairline py-3 pr-1"
            style={{
              animationDelay: `${i * 40}ms`,
              paddingLeft: mine ? 10 : 12,
              borderLeft: mine ? '2px solid var(--color-accent-default)' : undefined,
            }}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-mono text-[10px] tracking-[0.1em] text-text-muted">
                {mine ? 'você' : shortUid(entry.uid)}
                {entry.mode === 'hat-pro' && <span className="text-accent-hover"> · pro</span>}
              </span>
              <time className="shrink-0 font-mono text-[10px] text-text-muted tabular-nums">
                {timeFormat.format(entry.createdAt)}
              </time>
            </div>
            <p className="mt-1 mb-0 text-[13px] leading-relaxed text-text-primary">
              {entry.questionText}
            </p>
            {entry.extractedAnswer !== null && (
              <span className="mt-2 inline-block rounded-xs border border-solid border-hairline-strong px-2 py-0.5 font-mono text-[11px] text-text-secondary tabular-nums">
                {String(entry.extractedAnswer)}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
