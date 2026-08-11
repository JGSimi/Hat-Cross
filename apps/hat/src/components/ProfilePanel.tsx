import { useState } from 'react';
import { motion } from 'framer-motion';
import type { AuthSession } from '../bridge/auth';
import type { AccountStatus } from '../services/account';
import { trialDaysLeft } from '../services/account';
import { firstNameOf, greetingFor } from '../domain/greeting';
import { useCountUp } from '../hooks/useCountUp';
import { HatLogo } from './HatLogo';

export type UserTier = 'subscriber' | 'trial' | 'none';

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
const DIGITAL: React.CSSProperties = { fontFamily: 'var(--font-digital)', textTransform: 'uppercase' };
const MUTED = 'rgb(255 255 255 / 0.5)';

/** Largura da barra de uso: log-scale, nunca encosta no ∞ (a piada é essa). */
export function usageBarPct(creditsSpent: number): number {
  if (creditsSpent <= 0) return 4;
  const pct = Math.log10(1 + creditsSpent) * 18;
  return Math.max(8, Math.min(82, pct));
}

const stagger = (step: number) => ({ animationDelay: `${step * 90}ms` });

/**
 * Perfil — redesign landscape na linguagem da HatHome (#141414, azul #007bff,
 * fonte de 7-segmentos nos números): identidade + uso à esquerda, assinatura à
 * direita. Cabe na janela curta sem scroll. Assinante gerencia; não-assinante
 * recebe o convite. O "sair" fica discreto, longe de cliques acidentais.
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
  const animatedSpent = useCountUp(spent);
  const daysLeft = trialDaysLeft(account?.trialEndsAt ?? null);
  const periodEnd = account?.subscription?.currentPeriodEnd;

  return (
    <section
      className="mx-auto flex h-full min-h-0 w-full max-w-[880px] flex-col gap-6 sm:flex-row sm:items-center sm:gap-10"
      aria-label="Perfil"
      style={{ color: '#fff' }}
    >
      {/* ── Coluna esquerda: identidade + uso ── */}
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <div className="hat-rise flex items-center gap-4" style={stagger(0)}>
          <span className="hat-avatar size-14 shrink-0" data-tier={tier}>
            {photo ? (
              <img
                src={photo}
                alt=""
                referrerPolicy="no-referrer"
                onError={() => setImgFailed(true)}
                className="size-14 rounded-full object-cover"
              />
            ) : (
              <span
                aria-hidden
                className="flex size-14 items-center justify-center rounded-full font-mono text-[17px]"
                style={{ background: '#3d3d3d', color: '#fff' }}
              >
                {(name || '?').slice(0, 1).toUpperCase()}
              </span>
            )}
          </span>
          <div className="min-w-0">
            <h1 className="m-0 truncate text-[24px] leading-tight font-light tracking-[-0.01em]">
              {greetingFor(hour)}
              {name ? `, ${name}` : ''}
            </h1>
            <p className="mt-1 mb-0 truncate font-mono text-[11px]" style={{ color: MUTED }}>
              {session.email ?? session.uid}
            </p>
          </div>
        </div>

        <div className="hat-rise mt-8" style={stagger(1)}>
          <h2 className="m-0 mb-3 font-mono text-[10px] tracking-[0.2em] uppercase" style={{ color: MUTED }}>
            Seu uso
          </h2>
          <div className="flex items-baseline justify-between gap-3">
            <span className="leading-none tabular-nums" style={{ ...DIGITAL, fontSize: 'clamp(30px, 7vh, 44px)' }}>
              {numberFmt.format(animatedSpent)}
            </span>
            <span className="text-[12px]" style={{ color: MUTED }}>
              unidades até hoje
            </span>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div
              className="relative h-1.5 flex-1 overflow-hidden rounded-full"
              style={{ background: 'rgb(255 255 255 / 0.1)' }}
              role="img"
              aria-label="Uso em relação ao limite: ilimitado"
            >
              <motion.div
                data-testid="usage-fill"
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ background: '#007bff' }}
                initial={{ width: '0%' }}
                animate={{ width: `${usageBarPct(spent)}%` }}
                transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.15 }}
              />
            </div>
            <span
              data-testid="usage-infinity"
              className="hat-infinity text-[24px] leading-none font-light"
              style={{ color: 'rgb(255 255 255 / 0.7)' }}
              title="Seu limite"
            >
              ∞
            </span>
          </div>

        </div>
      </div>

      {/* ── Coluna direita: assinatura + sair ── */}
      <div className="hat-rise flex w-full flex-col justify-center sm:w-[46%]" style={stagger(2)}>
        {tier === 'subscriber' ? (
          <div
            className="rounded-[16px] p-6"
            style={{ background: '#1c1c1c', border: '1px solid rgb(255 255 255 / 0.1)' }}
          >
            <p className="m-0 font-mono text-[9.5px] tracking-[0.22em] uppercase" style={{ color: MUTED }}>
              Assinatura
            </p>
            <p className="mt-3 mb-0 text-[15px]">
              Hat Ilimitado <span style={{ color: '#4da3ff' }}>· ativo</span>
            </p>
            <p className="mt-1 mb-0 text-[11.5px]" style={{ color: MUTED }}>
              {typeof periodEnd === 'number' && periodEnd > 0
                ? `próxima renovação em ${dateFmt.format(periodEnd)}`
                : 'obrigado por apoiar o Hat'}
            </p>
            <button
              type="button"
              data-testid="manage-subscription"
              onClick={onManageSubscription}
              className="hat-btn hat-btn-ghost mt-5 w-full"
              style={{ borderColor: 'rgb(255 255 255 / 0.16)', color: 'rgb(255 255 255 / 0.75)' }}
            >
              Gerenciar assinatura
            </button>
          </div>
        ) : (
          <div
            data-testid="subscribe-hero"
            className="hat-hero relative overflow-hidden rounded-[16px] p-6"
            style={{
              background: 'radial-gradient(120% 140% at 85% -20%, rgb(0 123 255 / 0.22), transparent 55%), #1c1c1c',
              border: '1px solid rgb(255 255 255 / 0.1)',
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="m-0 font-mono text-[9.5px] tracking-[0.22em] uppercase" style={{ color: MUTED }}>
                  Hat Ilimitado
                </p>
                <div className="mt-2 flex flex-col gap-1">
                  <div className="flex items-baseline gap-2">
                    <span className="leading-none tabular-nums text-[#007bff]" style={{ ...DIGITAL, fontSize: 'clamp(34px, 8vh, 48px)' }}>
                      R$30
                    </span>
                    <span className="text-[12px]" style={{ color: MUTED }}>
                      /mês
                    </span>
                  </div>
                </div>
                {tier === 'trial' && (
                  <p className="mt-2 mb-0 font-mono text-[10px] tracking-[0.12em] uppercase" style={{ color: MUTED }}>
                    seu teste termina em {daysLeft}d
                  </p>
                )}
              </div>
              <span className="hat-avatar mt-1 size-11 shrink-0" data-tier="subscriber">
                <span className="flex size-11 items-center justify-center rounded-full" style={{ background: '#141414' }}>
                  <HatLogo size={24} style={{ color: '#fff' }} />
                </span>
              </span>
            </div>
            <button
              type="button"
              data-testid="profile-subscribe"
              onClick={onSubscribe}
              className="hat-btn hat-btn-blue mt-5 w-full py-3 font-mono tracking-[0.04em]"
            >
              Assinar agora →
            </button>
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            data-testid="sign-out"
            onClick={onSignOut}
            className="cursor-pointer border-0 bg-transparent p-0 font-mono text-[10px] tracking-[0.12em] uppercase transition-colors duration-200"
            style={{ color: MUTED }}
          >
            sair da conta
          </button>
        </div>
      </div>
    </section>
  );
}
