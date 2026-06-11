import { clusterView, divergenceMessage } from '../../domain/rooms/consensus';
import type { RoomCluster, RoomEntry } from '../../domain/rooms/types';
import { HatLogo } from '../HatLogo';

interface RoomConsensusPanelProps {
  clusters: RoomCluster[];
  entries: RoomEntry[];
  myUid: string;
}

/**
 * O coração da sala: cada cluster é um "veredito" — resposta de consenso em
 * display ultraleve, confiança como hairline, divergência em âmbar com a
 * mensagem do domínio (nunca "errado"; regra de produto).
 */
export function RoomConsensusPanel({ clusters, entries, myUid }: RoomConsensusPanelProps) {
  if (clusters.length === 0) {
    return (
      <div className="flex flex-col items-center px-1 py-10 text-center" data-testid="consensus-empty">
        <HatLogo size={40} className="text-text-muted" />
        <p className="mt-2 mb-0 text-[12px] text-text-muted">
          O consenso aparece aqui quando a sala começar a perguntar.
        </p>
      </div>
    );
  }

  return (
    <ol className="m-0 flex list-none flex-col gap-7 p-0" data-testid="consensus-panel">
      {clusters.map((cluster, i) => {
        const view = clusterView(cluster, entries, myUid);
        const confidencePct = Math.round(cluster.consensusConfidence * 100);

        return (
          <li
            key={cluster.id}
            data-testid={`cluster-${cluster.id}`}
            className="hat-rise"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <p className="m-0 text-[11.5px] leading-relaxed text-text-secondary">
              {view.canonicalQuestion}
            </p>

            {view.tone === 'pending' ? (
              <p
                data-testid="cluster-pending"
                className="hat-pulse font-display mt-1.5 mb-0 text-[30px] leading-none font-extralight tracking-[-0.02em] text-text-muted"
              >
                aguardando consenso…
              </p>
            ) : (
              <p
                data-testid="cluster-answer"
                className="font-display mt-1.5 mb-0 text-[30px] leading-none font-extralight tracking-[-0.02em] text-text-primary"
              >
                {String(view.consensusAnswer)}
              </p>
            )}

            {view.tone !== 'pending' && (
              <div
                className="mt-3 h-px w-full overflow-hidden rounded-full bg-hairline"
                role="img"
                aria-label={`Confiança do consenso: ${confidencePct}%`}
              >
                <div
                  className="h-full transition-[width] duration-600"
                  style={{
                    width: `${confidencePct}%`,
                    background:
                      view.tone === 'divergence'
                        ? 'var(--color-divergence)'
                        : 'var(--color-consensus)',
                  }}
                />
              </div>
            )}

            <p className="mt-2 mb-0 font-mono text-[10.5px] tracking-[0.08em] text-text-muted tabular-nums">
              {view.totalEntries} {view.totalEntries === 1 ? 'resposta' : 'respostas'}
              {view.divergentCount > 0 && (
                <> · {view.divergentCount} {view.divergentCount === 1 ? 'diverge' : 'divergem'}</>
              )}
              {view.tone !== 'pending' && <> · {confidencePct}%</>}
            </p>

            {view.iDiverge && (
              <p
                data-testid="cluster-divergence-message"
                className="mt-2.5 mb-0 border-0 border-l-2 border-solid py-0.5 pl-3 text-[12px] leading-relaxed"
                style={{
                  borderLeftColor: 'var(--color-divergence)',
                  color: 'var(--color-divergence)',
                }}
              >
                {divergenceMessage(cluster.answerType)}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
