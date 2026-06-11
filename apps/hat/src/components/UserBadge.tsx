import { useState } from 'react';
import type { AuthSession } from '../bridge/auth';

export type UserTier = 'subscriber' | 'trial' | 'none';

interface UserBadgeProps {
  session: AuthSession;
  tier: UserTier;
  /** Dias restantes de trial (mostrado só quando tier === 'trial'). */
  trialDaysLeft?: number;
  onSignOut: () => void;
}

function initials(session: AuthSession): string {
  const source = session.displayName ?? session.email ?? '?';
  const parts = source.replace(/@.*$/, '').split(/[\s._-]+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '?';
  const second = parts[1]?.[0] ?? '';
  return (first + second).toUpperCase();
}

/**
 * Identidade do usuário no topo: avatar com anel — girando em gradiente para
 * assinantes (o detalhe "você é especial"), âmbar estático no trial. Foto do
 * Google quando existe; iniciais como fallback. Hover revela o sair.
 */
export function UserBadge({ session, tier, trialDaysLeft, onSignOut }: UserBadgeProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const photo = !imgFailed && session.photoURL ? session.photoURL : null;
  const tierLabel =
    tier === 'subscriber' ? 'assinante' : tier === 'trial' ? `trial · ${trialDaysLeft ?? 0}d` : null;

  return (
    <div className="group flex items-center gap-2.5" data-testid="user-badge">
      {tierLabel && (
        <span
          data-testid="tier-label"
          className="font-mono text-[10px] tracking-[0.12em] uppercase transition-colors duration-200"
          style={{
            color: tier === 'subscriber' ? 'var(--color-consensus)' : 'var(--color-text-muted)',
          }}
        >
          {tierLabel}
        </span>
      )}
      <span className="font-mono text-[11px] text-text-secondary" data-testid="session-email">
        {session.email ?? session.displayName ?? session.uid}
      </span>
      <span
        className="hat-avatar size-7 shrink-0"
        data-tier={tier}
        title={tier === 'subscriber' ? 'Assinante Hat — obrigado por apoiar' : undefined}
      >
        {photo ? (
          <img
            src={photo}
            alt=""
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="size-7 rounded-full object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="flex size-7 items-center justify-center rounded-full bg-surface-raised font-mono text-[10px] text-text-secondary"
          >
            {initials(session)}
          </span>
        )}
      </span>
      <button
        type="button"
        onClick={onSignOut}
        className="cursor-pointer border-0 bg-transparent p-0 font-mono text-[10px] tracking-[0.12em] text-text-muted uppercase opacity-60 transition-all duration-200 group-hover:opacity-100 hover:text-text-primary"
      >
        sair
      </button>
    </div>
  );
}
