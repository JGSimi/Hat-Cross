import { useState } from 'react';
import type { AuthSession } from '../bridge/auth';
import type { AccountStatus } from '../services/account';
import { trialDaysLeft } from '../services/account';
import { firstNameOf, greetingFor } from '../domain/greeting';
import { HatLogo } from './HatLogo';
import type { UserTier } from './UserBadge';

interface ProfilePanelProps {
  session: AuthSession;
  account: AccountStatus | null;
  tier: UserTier;
  /** Abre o portal Stripe (gerenciar assinatura). */
  onManageSubscription: () => void;
  /** Abre o checkout (assinar). */
  onSubscribe: () => void;
  onSignOut: () => void;
  /** Hora atual (injetável em testes). */
  hour?: number;
}

const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long' });
const numberFmt = new Intl.NumberFormat('pt-BR');

/** Largura da barra de uso: log-scale, nunca encosta no ∞ (a piada é essa). */
export function usageBarPct(creditsSpent: number): number {
  if (creditsSpent <= 0) return 4;
  const pct = Math.log10(1 + creditsSpent) * 18;
  return Math.max(8, Math.min(82, pct));
}

/**
 * Perfil: identidade + uso (com limite ∞, ironicamente) + assinatura.
 * Assinante gerencia; não-assinante recebe o convite premium. O "sair"
 * vive aqui, discreto, longe de cliques acidentais.
 */
export function ProfilePanel({
  session,
  account,
  tier,
  onManageSubscription,
  onSubscribe,
  onSignOut,
  hour = new Date().getHours(),
}: ProfilePanelProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const photo = !imgFailed && session.photoURL ? session.photoURL : null;
  const name = firstNameOf(session.displayName, session.email);
  const spent = account?.creditsSpent ?? 0;
  const daysLeft = trialDaysLeft(account?.trialEndsAt ?? null);
  const periodEnd = account?.subscription?.currentPeriodEnd;

  return (
    <section className="flex h-full min-h-0 flex-col overflow-y-auto" aria-label="Perfil">
      {/* ── Identidade ── */}
      <div className="flex items-center gap-5">
        <span className="hat-avatar size-16 shrink-0" data-tier={tier}>
          {photo ? (
            <img
              src={photo}
              alt=""
              referrerPolicy="no-referrer"
              onError={() => setImgFailed(true)}
              className="size-16 rounded-full object-cover"
            />
          ) : (
            <span
              aria-hidden
              className="flex size-16 items-center justify-center rounded-full bg-surface-raised font-mono text-[18px] text-text-secondary"
            >
              {(name || '?').slice(0, 1).toUpperCase()}
            </span>
          )}
        </span>
        <div className="min-w-0">
          <h1 className="font-display m-0 truncate text-[30px] leading-tight font-extralight tracking-[-0.02em] text-text-primary">
            {greetingFor(hour)}
            {name ? `, ${name}` : ''}
          </h1>
          <p className="mt-1 mb-0 truncate font-mono text-[11px] text-text-muted">
            {session.email ?? session.uid}
          </p>
        </div>
      </div>

      {/* ── Uso ── */}
      <h2 className="mt-9 mb-1 font-mono text-[10px] tracking-[0.2em] text-text-muted uppercase">
        Seu uso
      </h2>
      <div className="border-0 border-t border-solid border-t-hairline pt-4">
        <div className="flex items-baseline justify-between">
          <span className="font-display text-[34px] leading-none font-extralight tracking-[-0.02em] text-text-primary tabular-nums">
            {numberFmt.format(spent)}
          </span>
          <span className="text-[12px] text-text-muted">unidades de uso até hoje</span>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <div
            className="relative h-1.5 flex-1 overflow-hidden rounded-full"
            style={{ background: 'var(--color-hairline)' }}
            role="img"
            aria-label="Uso em relação ao limite: ilimitado"
          >
            <div
              data-testid="usage-fill"
              className="hat-usage-fill absolute inset-y-0 left-0 rounded-full"
              style={{ width: `${usageBarPct(spent)}%` }}
            />
          </div>
          <span
            data-testid="usage-infinity"
            className="font-display text-[26px] leading-none font-extralight text-text-secondary"
            title="Seu limite"
          >
            ∞
          </span>
        </div>
        <p className="mt-2 mb-0 text-[11.5px] text-text-muted">
          Esse é todo o caminho até o seu limite. Spoiler: você nunca chega lá.
        </p>
      </div>

      {/* ── Assinatura ── */}
      <h2 className="mt-9 mb-1 font-mono text-[10px] tracking-[0.2em] text-text-muted uppercase">
        Assinatura
      </h2>
      <div className="border-0 border-t border-solid border-t-hairline pt-4 pb-2">
        {tier === 'subscriber' ? (
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="m-0 text-[14px] text-text-primary">
                Hat Ilimitado <span className="text-consensus">· ativo</span>
              </p>
              <p className="mt-1 mb-0 text-[11.5px] text-text-muted">
                {typeof periodEnd === 'number' && periodEnd > 0
                  ? `próxima renovação em ${dateFmt.format(periodEnd)}`
                  : 'obrigado por apoiar o Hat'}
              </p>
            </div>
            <button
              type="button"
              data-testid="manage-subscription"
              onClick={onManageSubscription}
              className="hat-btn hat-btn-ghost"
            >
              Gerenciar assinatura
            </button>
          </div>
        ) : (
          <div
            data-testid="subscribe-hero"
            className="hat-rise relative overflow-hidden rounded-lg border border-solid border-hairline-strong p-6"
            style={{
              background:
                'radial-gradient(120% 140% at 85% -20%, rgb(99 102 241 / 0.14), transparent 55%), var(--color-surface-raised)',
            }}
          >
            <div className="flex items-start justify-between gap-6">
              <div className="min-w-0">
                <p className="m-0 font-mono text-[9.5px] tracking-[0.22em] text-text-muted uppercase">
                  Hat Ilimitado
                </p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="font-display text-[44px] leading-none font-extralight tracking-[-0.03em] text-text-primary tabular-nums">
                    R$50
                  </span>
                  <span className="text-[12px] text-text-muted">/mês</span>
                </div>
                <ul className="mt-4 mb-0 flex list-none flex-col gap-1.5 p-0 text-[12.5px] text-text-secondary">
                  <li>Flash e salas sem nenhum limite</li>
                  <li>IA da sala corrigindo o grupo em tempo real</li>
                  <li>O anel. Você vai entender.</li>
                </ul>
                {tier === 'trial' && (
                  <p className="mt-3 mb-0 font-mono text-[10px] tracking-[0.12em] text-text-muted uppercase">
                    seu teste termina em {daysLeft}d
                  </p>
                )}
              </div>
              <span className="hat-avatar mt-1 size-12 shrink-0" data-tier="subscriber">
                <span className="flex size-12 items-center justify-center rounded-full bg-surface-overlay">
                  <HatLogo size={26} className="text-text-primary" />
                </span>
              </span>
            </div>
            <button
              type="button"
              data-testid="profile-subscribe"
              onClick={onSubscribe}
              className="hat-btn hat-btn-primary mt-5 w-full py-3 font-mono tracking-[0.04em]"
            >
              Assinar agora →
            </button>
          </div>
        )}
      </div>

      {/* ── Sair ── */}
      <div className="mt-auto flex justify-end pt-8 pb-2">
        <button
          type="button"
          data-testid="sign-out"
          onClick={onSignOut}
          className="cursor-pointer border-0 bg-transparent p-0 font-mono text-[10px] tracking-[0.12em] text-text-muted uppercase transition-colors duration-200 hover:text-text-primary"
        >
          sair da conta
        </button>
      </div>
    </section>
  );
}
