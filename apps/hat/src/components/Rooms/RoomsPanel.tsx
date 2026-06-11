import { useMemo, useState } from 'react';
import { useRoomStore } from '../../stores/roomStore';
import type { RoomsClient } from '../../services/rooms/client';
import { RoomsClientError } from '../../services/rooms/client';
import { RoomList } from './RoomList';
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

/**
 * Painel das salas (pivot): lista (salas que sou membro) + entrar por código +
 * nova sala — tudo grátis. Sala ativa mostra feed + consenso. Sem client
 * (deslogado), a demonstração local fica disponível.
 */
export function RoomsPanel({ client, myUid, authed }: RoomsPanelProps) {
  const store = useRoomStore();
  const [joinTargetId, setJoinTargetId] = useState<string | null>(null);
  const [joinBusy, setJoinBusy] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [demoUid, setDemoUid] = useState<string | null>(null);
  const [code, setCode] = useState('');
  // null = não criando; string = nome em edição (input inline — webview do
  // Tauri não tem window.prompt).
  const [creatingTitle, setCreatingTitle] = useState<string | null>(null);
  const [createBusy, setCreateBusy] = useState(false);

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

  async function confirmJoin(id?: string) {
    const targetId = id ?? joinTargetId;
    if (!targetId) return;
    if (!client) {
      // Demo local: "entra" sem rede.
      store.setActiveRoom(targetId);
      setJoinTargetId(null);
      return;
    }
    setJoinBusy(true);
    setJoinError(null);
    try {
      // Salas grátis: o Worker devolve o roomId; o documento completo chega
      // pelo realtime (subscribeRoom no MainPage).
      const ref = await client.joinRoom(targetId);
      store.setActiveRoom(ref.roomId);
      setJoinTargetId(null);
      setCode('');
    } catch (error) {
      setJoinError(
        error instanceof RoomsClientError && error.code === 'notFound'
          ? 'Sala não encontrada. Confira o código.'
          : error instanceof RoomsClientError && error.code === 'insufficientCredits'
            ? 'Sua conta precisa de assinatura/trial ativo.'
            : 'Não consegui entrar na sala. Tente de novo.',
      );
    } finally {
      setJoinBusy(false);
    }
  }

  function startCreate() {
    if (!requireClient()) return;
    setNotice(null);
    setCreatingTitle('');
  }

  async function confirmCreate() {
    if (!client || creatingTitle === null || createBusy) return;
    setCreateBusy(true);
    setNotice(null);
    try {
      const ref = await client.createRoom(creatingTitle.trim() || 'Sala de questionário');
      setCreatingTitle(null);
      store.setActiveRoom(ref.roomId);
    } catch (error) {
      setNotice(
        error instanceof RoomsClientError && error.code === 'insufficientCredits'
          ? 'Sua conta precisa de assinatura/trial ativo.'
          : 'Não consegui criar a sala. Tente de novo.',
      );
    } finally {
      setCreateBusy(false);
    }
  }

  function loadDemo() {
    const uid = seedDemo();
    setDemoUid(uid);
    setNotice(null);
  }

  // ── Sala ativa ─────────────────────────────────────────────────────────
  if (activeRoom) {
    const entries = store.entries[activeRoom.id] ?? [];
    const clusters = store.clusters[activeRoom.id] ?? [];
    const roomNotifications = store.notifications.filter(
      (n) => entries.some((e) => e.id === n.entryId) && n.uid === effectiveUid,
    );

    return (
      <section className="flex h-full min-h-0 flex-col" aria-label={activeRoom.title}>
        <header className="flex items-baseline gap-3 border-0 border-b border-solid border-b-hairline pb-3">
          <button
            type="button"
            onClick={() => store.setActiveRoom(null)}
            aria-label="Voltar para a lista de salas"
            className="cursor-pointer border-0 bg-transparent p-0 font-mono text-[12px] text-text-muted transition-colors duration-200 hover:text-text-primary"
          >
            ←
          </button>
          <h2 className="m-0 min-w-0 flex-1 truncate text-[15px] font-medium text-text-primary">
            {activeRoom.title}
          </h2>
          <span className="shrink-0 font-mono text-[10.5px] tracking-[0.1em] text-text-muted tabular-nums">
            {activeRoom.memberCount} membros
          </span>
        </header>

        <div className="mt-2">
          <RoomNotifications
            notifications={roomNotifications}
            onRead={store.markNotificationRead}
          />
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
              Consenso
            </p>
            <RoomConsensusPanel clusters={clusters} entries={entries} myUid={effectiveUid} />
          </div>
        </div>
      </section>
    );
  }

  // ── Lista de salas ─────────────────────────────────────────────────────
  return (
    <section className="flex h-full min-h-0 flex-col" aria-label="Salas">
      <header className="flex items-end justify-between gap-4">
        <h1 className="font-display m-0 text-[34px] leading-none font-extralight tracking-[-0.02em] text-text-primary">
          Salas
        </h1>
        <span className="font-mono text-[10px] tracking-[0.12em] text-text-muted uppercase">
          grátis
        </span>
      </header>
      <p className="mt-2 mb-0 max-w-130 text-[12.5px] leading-relaxed text-text-secondary">
        Cada um copia a questão e aciona o Flash. A IA da sala compara as
        respostas, apura a correta e avisa, pelo Flash, quem divergiu.
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
          placeholder="código da sala"
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
          onClick={startCreate}
          className="cursor-pointer rounded-sm border-0 bg-accent-default px-4 py-2 text-[13px] text-white transition-colors duration-200 hover:bg-accent-hover"
        >
          Nova sala
        </button>
      </form>

      {creatingTitle !== null && (
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void confirmCreate();
          }}
        >
          <input
            autoFocus
            value={creatingTitle}
            onChange={(e) => setCreatingTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setCreatingTitle(null)}
            placeholder="nome da sala (ex.: Prova de Cálculo · Turma B)"
            aria-label="Nome da nova sala"
            data-testid="create-title"
            className="min-w-0 flex-1 rounded-sm border border-solid border-accent-default bg-surface-raised px-3 py-2 text-[12.5px] text-text-primary outline-none placeholder:text-text-muted"
          />
          <button
            type="submit"
            disabled={createBusy}
            data-testid="create-confirm"
            className="cursor-pointer rounded-sm border-0 bg-accent-default px-4 py-2 text-[13px] text-white transition-colors duration-200 hover:bg-accent-hover disabled:opacity-50"
          >
            {createBusy ? 'Criando…' : 'Criar'}
          </button>
          <button
            type="button"
            onClick={() => setCreatingTitle(null)}
            className="cursor-pointer rounded-sm border border-solid border-hairline-strong bg-transparent px-3 py-2 text-[13px] text-text-secondary transition-colors duration-200 hover:text-text-primary"
          >
            Cancelar
          </button>
        </form>
      )}
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
            <span aria-hidden className="font-display block text-[56px] font-extralight text-text-muted">
              ♞
            </span>
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
            {/* Salas que já sou membro: clicar abre direto (grátis, sem modal). */}
            <RoomList rooms={roomList} onOpen={(id) => store.setActiveRoom(id)} />
          </>
        )}
      </div>
    </section>
  );
}
