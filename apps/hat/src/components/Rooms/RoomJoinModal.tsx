import { useId, useState } from 'react';
import type { Room } from '../../domain/rooms/types';

interface RoomJoinModalProps {
  room: Room;
  /** Saldo atual; null = desconhecido (servidor decide; UI não bloqueia). */
  credits: number | null;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmação de entrada na sala. Regras de produto:
 * - custo de 800 créditos explícito, com saldo atual e saldo após;
 * - botão desabilitado quando o saldo conhecido é insuficiente;
 * - consentimento de privacidade obrigatório (perguntas compartilhadas
 *   ficam visíveis para a sala) — V1 exige confirmação clara.
 */
export function RoomJoinModal({
  room,
  credits,
  busy = false,
  error = null,
  onConfirm,
  onCancel,
}: RoomJoinModalProps) {
  const [consented, setConsented] = useState(false);
  const consentId = useId();

  const insufficient = credits !== null && credits < room.joinCost;
  const balanceAfter = credits !== null ? credits - room.joinCost : null;
  const disabled = busy || insufficient || !consented;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Entrar na sala ${room.title}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-6"
    >
      <div className="hat-rise w-full max-w-95 rounded-lg border border-solid border-hairline-strong bg-surface-overlay p-6 shadow-2xl">
        <p className="m-0 font-mono text-[10px] tracking-[0.18em] text-text-muted uppercase">
          Entrar na sala
        </p>
        <h2 className="mt-1 mb-0 text-[17px] leading-snug font-medium text-text-primary">
          {room.title}
        </h2>

        <div className="mt-5 flex items-baseline gap-2.5">
          <span
            data-testid="join-cost"
            className="font-display text-[52px] leading-none font-extralight tracking-[-0.03em] text-text-primary tabular-nums"
          >
            {room.joinCost}
          </span>
          <span className="text-[12px] text-text-secondary">
            créditos para entrar
            <br />
            <span className="text-text-muted">cobrados uma única vez</span>
          </span>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-y-1 border-t border-solid border-t-hairline pt-4 font-mono text-[12px] tabular-nums">
          <dt className="m-0 text-text-muted">saldo atual</dt>
          <dd className="m-0 text-right text-text-secondary" data-testid="join-balance">
            {credits === null ? '—' : `${credits} cr`}
          </dd>
          <dt className="m-0 text-text-muted">após entrar</dt>
          <dd
            className="m-0 text-right"
            data-testid="join-balance-after"
            style={{
              color: insufficient ? 'var(--color-divergence)' : 'var(--color-text-secondary)',
            }}
          >
            {balanceAfter === null ? '—' : `${balanceAfter} cr`}
          </dd>
        </dl>

        {insufficient && (
          <p
            data-testid="join-insufficient"
            className="mt-3 mb-0 text-[12px]"
            style={{ color: 'var(--color-divergence)' }}
          >
            Saldo insuficiente para entrar nesta sala.
          </p>
        )}

        <label
          htmlFor={consentId}
          className="mt-5 flex cursor-pointer items-start gap-2.5 text-[12px] leading-relaxed text-text-secondary"
        >
          <input
            id={consentId}
            data-testid="join-consent"
            type="checkbox"
            checked={consented}
            onChange={(e) => setConsented(e.target.checked)}
            className="mt-0.5 accent-(--color-accent-default)"
          />
          Entendo que as perguntas que eu enviar com compartilhamento ligado
          ficam visíveis para todos os membros da sala.
        </label>

        {error && (
          <p role="alert" className="mt-3 mb-0 text-[12px] text-state-error">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="cursor-pointer rounded-sm border border-solid border-hairline-strong bg-transparent px-4 py-2 text-[13px] text-text-secondary transition-colors duration-200 hover:text-text-primary disabled:cursor-default disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            data-testid="join-confirm"
            onClick={onConfirm}
            disabled={disabled}
            className="cursor-pointer rounded-sm border-0 bg-accent-default px-4 py-2 font-mono text-[13px] text-white transition-colors duration-200 hover:bg-accent-hover disabled:cursor-default disabled:opacity-40"
          >
            {busy ? 'Entrando…' : `Entrar · ${room.joinCost} cr`}
          </button>
        </div>
      </div>
    </div>
  );
}
