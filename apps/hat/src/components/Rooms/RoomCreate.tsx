import { useState } from 'react';
import type { RoomsClient } from '../../services/rooms/client';
import { RoomsClientError } from '../../services/rooms/client';
import { HatLogo } from '../HatLogo';

interface RoomCreateProps {
  client: RoomsClient;
  onClose: () => void;
  onEnter: (roomId: string) => void;
}

/**
 * Tela dedicada de criação de sala (foco total): nome → cria → mostra o
 * CÓDIGO para compartilhar com o grupo → entrar. Substitui o input solto.
 */
export function RoomCreate({ client, onClose, onEnter }: RoomCreateProps) {
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const ref = await client.createRoom(title.trim() || 'Sala de questionário');
      setCreatedId(ref.roomId);
    } catch (e) {
      setError(
        e instanceof RoomsClientError && e.code === 'activeRoomExists'
          ? 'Você já está em outra sala. Saia dela antes de criar uma nova.'
          : e instanceof RoomsClientError && e.code === 'insufficientCredits'
            ? 'Sua conta precisa de assinatura/trial ativo.'
            : 'Não consegui criar a sala. Tente de novo.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function copyCode() {
    if (!createdId) return;
    try {
      await navigator.clipboard.writeText(createdId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* o código fica visível para digitar mesmo sem clipboard */
    }
  }

  // ── Sala criada: mostra o código para compartilhar ──
  if (createdId) {
    return (
      <section className="flex h-full flex-col items-center justify-center px-6 text-center" aria-label="Sala criada">
        <HatLogo size={40} className="text-consensus" />
        <h1 className="font-display mt-3 mb-0 text-[26px] font-extralight tracking-[-0.02em] text-text-primary">
          Sala criada
        </h1>
        <p className="mt-2 mb-0 max-w-90 text-[12.5px] leading-relaxed text-text-secondary">
          Compartilhe este código com o grupo. Quem entrar vê o mesmo quadro de
          respostas e correções.
        </p>

        <button
          type="button"
          onClick={() => void copyCode()}
          data-testid="room-code"
          title="Copiar código"
          className="hat-btn mt-6 rounded-md border-hairline-strong bg-surface-raised px-5 py-3 font-mono text-[18px] tracking-[0.06em] text-text-primary"
          style={{ borderColor: copied ? 'var(--color-consensus)' : undefined }}
        >
          {createdId}
          <span
            className="ml-3 font-mono text-[10px] tracking-[0.12em] uppercase transition-colors duration-200"
            style={{ color: copied ? 'var(--color-consensus)' : 'var(--color-text-muted)' }}
          >
            {copied ? 'copiado ✓' : 'copiar'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onEnter(createdId)}
          className="hat-btn hat-btn-primary mt-7 px-6 py-2.5"
        >
          Entrar na sala →
        </button>
      </section>
    );
  }

  // ── Formulário ──
  return (
    <section className="flex h-full flex-col" aria-label="Nova sala">
      <header className="flex items-baseline gap-3">
        <button
          type="button"
          onClick={onClose}
          aria-label="Voltar"
          className="cursor-pointer border-0 bg-transparent p-0 font-mono text-[12px] text-text-muted transition-colors duration-200 hover:text-text-primary"
        >
          ←
        </button>
        <h1 className="font-display m-0 text-[30px] leading-none font-extralight tracking-[-0.02em] text-text-primary">
          Nova sala
        </h1>
      </header>

      <form
        className="mx-auto mt-12 flex w-full max-w-105 flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label className="font-mono text-[10px] tracking-[0.2em] text-text-muted uppercase" htmlFor="room-title">
          Nome da sala
        </label>
        <input
          id="room-title"
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Prova de Cálculo · Turma B"
          data-testid="create-title"
          className="hat-field mt-2 w-full px-3.5 py-2.5 text-[14px]"
        />
        <p className="mt-2 mb-0 text-[11.5px] leading-relaxed text-text-muted">
          Você recebe um código para convidar o grupo. Entrar é grátis.
        </p>

        {error && (
          <p role="alert" className="mt-3 mb-0 text-[12px]" style={{ color: 'var(--color-divergence)' }}>
            {error}
          </p>
        )}

        <div className="mt-7 flex gap-2.5">
          <button
            type="submit"
            disabled={busy}
            data-testid="create-confirm"
            className="hat-btn hat-btn-primary px-5 py-2.5"
          >
            {busy ? 'Criando…' : 'Criar sala'}
          </button>
          <button type="button" onClick={onClose} className="hat-btn hat-btn-ghost px-5 py-2.5">
            Cancelar
          </button>
        </div>
      </form>
    </section>
  );
}
