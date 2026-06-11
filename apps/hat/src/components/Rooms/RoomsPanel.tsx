import { useMemo, useState } from 'react';
import { useRoomStore } from '../../stores/roomStore';
import type { RoomsClient } from '../../services/rooms/client';
import { RoomsClientError } from '../../services/rooms/client';
import { RoomList } from './RoomList';
import { RoomCreate } from './RoomCreate';
import { RoomEntriesFeed } from './RoomEntriesFeed';
import { RoomConsensusPanel } from './RoomConsensusPanel';
import { RoomNotifications } from './RoomNotifications';
import { seedDemo } from './demoSeed';

interface RoomsPanelProps {
  /** Cliente HTTP das salas; null sem assinatura/trial ou sem login. */
  client: RoomsClient | null;
  /** @deprecated saldo de créditos — não usado no pivot (salas grátis). */
  credits?: number | null;
  /** Uid da sessão; null sem login (demo usa uid simulado). */
  myUid: string | null;
  /** Usuário autenticado? Distingue "conecte sua conta" de "sem assinatura". */
  authed: boolean;
}

type View = 'list' | 'create';

/**
 * Painel das salas (pivot): lista (salas que sou membro) + entrar por código +
 * tela dedicada de criação. Sala ativa = quadro de respostas compartilhado
 * (feed + consenso da IA). Sair pede confirmação; sala sem membros é deletada
 * no backend.
 */
export function RoomsPanel({ client, myUid, authed }: RoomsPanelProps) {
  const store = useRoomStore();
  const [view, setView] = useState<View>('list');
  const [joinBusy, setJoinBusy] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [demoUid, setDemoUid] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [leaveBusy, setLeaveBusy] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const effectiveUid = myUid ?? demoUid ?? '';
  const roomList = useMemo(
    () => Object.values(store.rooms).sort((a, b) => b.updatedAt - a.updatedAt),
    [store.rooms],
  );
  const activeRoom = store.activeRoomId ? store.rooms[store.activeRoomId] : undefined;

  function requireClient(): boolean {
    if (client) return true;
    setNotice(
      authed
        ? 'Conta sem assinatura/trial ativos. Veja a demonstração local enquanto isso.'
        : 'Conecte sua conta (botão no topo) para criar e entrar em salas.',
    );
    return false;
  }

  async function confirmJoin(targetId: string) {
    if (!targetId) return;
    if (!client) {
      store.setActiveRoom(targetId); // demo local
      setCode('');
      return;
    }
    setJoinBusy(true);
    setJoinError(null);
    try {
      const ref = await client.joinRoom(targetId);
      store.setActiveRoom(ref.roomId);
      setCode('');
    } catch (error) {
      const code = error instanceof RoomsClientError ? error.code : 'roomError';
      setJoinError(
        code === 'notFound'
          ? 'Sala não encontrada. Confira o código.'
          : code === 'activeRoomExists'
            ? 'Você já está em outra sala. Saia dela antes de entrar em outra.'
            : code === 'insufficientCredits'
              ? 'Sua conta precisa de assinatura/trial ativo.'
              : 'Não consegui entrar na sala. Tente de novo.',
      );
    } finally {
      setJoinBusy(false);
    }
  }

  async function leaveRoom() {
    const roomId = store.activeRoomId;
    if (!roomId) return;
    setLeaveBusy(true);
    try {
      if (client) await client.leaveRoom(roomId);
    } catch {
      /* mesmo se falhar a rede, saímos da visão; o realtime reconcilia */
    } finally {
      setLeaveBusy(false);
      setConfirmingLeave(false);
      store.setActiveRoom(null);
    }
  }

  function loadDemo() {
    setDemoUid(seedDemo());
    setNotice(null);
  }

  async function copyActiveCode() {
    if (!activeRoom) return;
    try {
      await navigator.clipboard.writeText(activeRoom.id);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1500);
    } catch {
      /* código fica visível mesmo sem clipboard */
    }
  }

  // ── Tela de criação dedicada ─────────────────────────────────────────────
  if (view === 'create' && client) {
    return (
      <RoomCreate
        client={client}
        onClose={() => setView('list')}
        onEnter={(roomId) => {
          setView('list');
          store.setActiveRoom(roomId);
        }}
      />
    );
  }

  // ── Sala ativa (quadro de respostas) ─────────────────────────────────────
  if (activeRoom) {
    const entries = store.entries[activeRoom.id] ?? [];
    const clusters = store.clusters[activeRoom.id] ?? [];
    const roomNotifications = store.notifications.filter(
      (n) => entries.some((e) => e.id === n.entryId) && n.uid === effectiveUid,
    );

    return (
      <section className="flex h-full min-h-0 flex-col" aria-label={activeRoom.title}>
        <header className="flex items-center gap-3 border-0 border-b border-solid border-b-hairline pb-3">
          <button
            type="button"
            onClick={() => store.setActiveRoom(null)}
            aria-label="Voltar para a lista de salas"
            title="Voltar (continua na sala)"
            className="cursor-pointer border-0 bg-transparent p-0 font-mono text-[13px] text-text-muted transition-colors duration-200 hover:text-text-primary"
          >
            ←
          </button>
          <h2 className="m-0 min-w-0 flex-1 truncate text-[15px] font-medium text-text-primary">
            {activeRoom.title}
          </h2>
          <button
            type="button"
            onClick={() => void copyActiveCode()}
            title="Copiar código para convidar"
            data-testid="active-room-code"
            className="shrink-0 cursor-pointer rounded-sm border border-solid border-hairline-strong bg-surface-raised px-2 py-1 font-mono text-[10.5px] text-text-secondary transition-colors duration-200 hover:text-text-primary"
          >
            {copiedCode ? 'copiado ✓' : activeRoom.id}
          </button>
          <span className="shrink-0 font-mono text-[10.5px] tracking-[0.1em] text-text-muted tabular-nums">
            {activeRoom.memberCount} {activeRoom.memberCount === 1 ? 'membro' : 'membros'}
          </span>
          {client && (
            <button
              type="button"
              onClick={() => setConfirmingLeave(true)}
              data-testid="leave-room"
              className="shrink-0 cursor-pointer border-0 bg-transparent p-0 font-mono text-[10px] tracking-[0.12em] uppercase transition-colors duration-200"
              style={{ color: 'var(--color-divergence)' }}
            >
              sair
            </button>
          )}
        </header>

        <div className="mt-2">
          <RoomNotifications notifications={roomNotifications} onRead={store.markNotificationRead} />
        </div>

        <div className="mt-3 grid min-h-0 flex-1 grid-cols-[7fr_5fr] gap-7 overflow-hidden">
          <div className="min-h-0 overflow-y-auto pr-1">
            <p className="m-0 mb-1 font-mono text-[9.5px] tracking-[0.2em] text-text-muted uppercase">
              Perguntas da sala
            </p>
            <RoomEntriesFeed entries={entries} myUid={effectiveUid} />
          </div>
          <div className="min-h-0 overflow-y-auto border-0 border-l border-solid border-l-hairline pl-7">
            <p className="m-0 mb-3 font-mono text-[9.5px] tracking-[0.2em] text-text-muted uppercase">
              Resposta da sala
            </p>
            <RoomConsensusPanel clusters={clusters} entries={entries} myUid={effectiveUid} />
          </div>
        </div>

        {confirmingLeave && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Sair da sala"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-6"
          >
            <div className="hat-rise w-full max-w-90 rounded-lg border border-solid border-hairline-strong bg-surface-overlay p-6">
              <h3 className="m-0 text-[16px] font-medium text-text-primary">Sair da sala?</h3>
              <p className="mt-2 mb-0 text-[12.5px] leading-relaxed text-text-secondary">
                Você deixa de ver as questões e correções desta sala. Se for o
                último a sair, a sala é apagada. Dá para voltar com o código.
              </p>
              <div className="mt-6 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setConfirmingLeave(false)}
                  className="cursor-pointer rounded-sm border border-solid border-hairline-strong bg-transparent px-4 py-2 text-[13px] text-text-secondary transition-colors duration-200 hover:text-text-primary"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  data-testid="leave-confirm"
                  onClick={() => void leaveRoom()}
                  disabled={leaveBusy}
                  className="cursor-pointer rounded-sm border-0 px-4 py-2 font-mono text-[13px] text-white transition-opacity duration-200 disabled:opacity-50"
                  style={{ background: 'var(--color-divergence)' }}
                >
                  {leaveBusy ? 'Saindo…' : 'Sair da sala'}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    );
  }

  // ── Lista de salas ────────────────────────────────────────────────────────
  return (
    <section className="flex h-full min-h-0 flex-col" aria-label="Salas">
      <header className="flex items-end justify-between gap-4">
        <h1 className="font-display m-0 text-[34px] leading-none font-extralight tracking-[-0.02em] text-text-primary">
          Salas
        </h1>
        <span className="font-mono text-[10px] tracking-[0.12em] text-text-muted uppercase">grátis</span>
      </header>
      <p className="mt-2 mb-0 max-w-130 text-[12.5px] leading-relaxed text-text-secondary">
        Um quadro de respostas do grupo: cada um aciona o Flash numa questão, a
        IA da sala apura a resposta certa e avisa, pelo Flash, quem divergiu.
      </p>

      <form
        className="mt-6 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!requireClient()) return;
          if (code.trim()) void confirmJoin(code.trim());
        }}
      >
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="código da sala (ex.: room_ab12cd)"
          aria-label="Código da sala"
          className="min-w-0 flex-1 rounded-sm border border-solid border-hairline-strong bg-surface-raised px-3 py-2 font-mono text-[12.5px] text-text-primary outline-none placeholder:text-text-muted focus:border-accent-default"
        />
        <button
          type="submit"
          disabled={joinBusy}
          className="cursor-pointer rounded-sm border border-solid border-hairline-strong bg-transparent px-4 py-2 text-[13px] text-text-secondary transition-colors duration-200 hover:text-text-primary disabled:opacity-50"
        >
          {joinBusy ? 'Entrando…' : 'Entrar'}
        </button>
        <button
          type="button"
          onClick={() => {
            if (requireClient()) setView('create');
          }}
          className="cursor-pointer rounded-sm border-0 bg-accent-default px-4 py-2 text-[13px] text-white transition-colors duration-200 hover:bg-accent-hover"
        >
          Nova sala
        </button>
      </form>
      {joinError && (
        <p role="alert" className="mt-2 mb-0 text-[12px]" style={{ color: 'var(--color-divergence)' }}>
          {joinError}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-3 mb-0 text-[12px]" style={{ color: 'var(--color-divergence)' }}>
          {notice}
        </p>
      )}

      <div className="mt-6 min-h-0 flex-1 overflow-y-auto">
        {roomList.length === 0 ? (
          <div className="px-1 py-14 text-center" data-testid="rooms-empty">
            <span aria-hidden className="font-display block text-[56px] font-extralight text-text-muted">♞</span>
            <p className="mx-auto mt-3 mb-0 max-w-70 text-[12.5px] leading-relaxed text-text-muted">
              Nenhuma sala por aqui. Crie uma, entre por código —{' '}
              <button
                type="button"
                onClick={loadDemo}
                data-testid="load-demo"
                className="cursor-pointer border-0 bg-transparent p-0 text-[12.5px] text-text-secondary underline decoration-(--color-hairline-strong) underline-offset-2 transition-colors duration-200 hover:text-text-primary"
              >
                ou veja uma demonstração local
              </button>
              .
            </p>
          </div>
        ) : (
          <>
            {demoUid && (
              <p className="m-0 mb-2 font-mono text-[9.5px] tracking-[0.2em] text-text-muted uppercase">
                demonstração local — nada sai do seu computador
              </p>
            )}
            <RoomList rooms={roomList} onOpen={(id) => store.setActiveRoom(id)} />
          </>
        )}
      </div>
    </section>
  );
}
