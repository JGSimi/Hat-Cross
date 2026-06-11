import { useState } from 'react';
import type { AuthSession } from '../bridge/auth';
import { firstNameOf, greetingFor } from '../domain/greeting';

export type UserTier = 'subscriber' | 'trial' | 'none';

interface UserBadgeProps {
  session: AuthSession;
  tier: UserTier;
  /** Dias restantes de trial (mostrado só quando tier === 'trial'). */
  trialDaysLeft?: number;
  /** Abre a tela de Perfil (avatar é o botão). */
  onOpenProfile: () => void;
  /** Hora atual (injetável em testes). */
  hour?: number;
}

function initials(session: AuthSession): string {
  const source = session.displayName ?? session.email ?? '?';
  const parts = source.replace(/@.*$/, '').split(/[\s._-]+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '?';
  const second = parts[1]?.[0] ?? '';
  return (first + second).toUpperCase();
}

/**
 * Identidade no topo: saudação humana ("Boa noite, João") + avatar com anel
 * de assinante (gradiente girando) ou trial (âmbar estático). O anel fala por
 * si — sem rótulo "assinante". Clicar no avatar abre o Perfil.
 */
export function UserBadge({
  session,
  tier,
  trialDaysLeft,
  onOpenProfile,
  hour = new Date().getHours(),
}: UserBadgeProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const photo = !imgFailed && session.photoURL ? session.photoURL : null;
  const name = firstNameOf(session.displayName, session.email);

  return (
    <div className="flex items-center gap-3" data-testid="user-badge">
      {tier === 'trial' && (
        <span
          data-testid="tier-label"
          className="font-mono text-[10px] tracking-[0.12em] text-text-muted uppercase"
        >
          trial · {trialDaysLeft ?? 0}d
        </span>
      )}
      <span className="text-[12.5px] text-text-secondary" data-testid="greeting">
        {greetingFor(hour)}
        {name ? (
          <>
            , <span className="text-text-primary">{name}</span>
          </>
        ) : null}
      </span>
      <button
        type="button"
        onClick={onOpenProfile}
        data-testid="open-profile"
        aria-label="Abrir perfil"
        title="Seu perfil"
        className="hat-avatar size-7 shrink-0 cursor-pointer border-0 bg-transparent p-0 transition-transform duration-200 hover:scale-110"
        data-tier={tier}
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
      </button>
    </div>
  );
}
