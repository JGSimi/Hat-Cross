import { trialDaysLeft } from '../services/account';
import { HatLogo } from './HatLogo';

interface PaywallProps {
  trialEndsAt: number | null;
  onSubscribe: () => void;
}

const DIGITAL: React.CSSProperties = { fontFamily: 'var(--font-digital)', textTransform: 'uppercase' };

/**
 * Bloqueio de quem nunca assinou / trial vencido. Redesign na linguagem da
 * HatHome (#141414, azul #007bff, fonte de 7-segmentos nos números), layout
 * landscape que cabe na janela curta: mascote à esquerda, oferta à direita.
 */
export function Paywall({ trialEndsAt, onSubscribe }: PaywallProps) {
  const everHadTrial = typeof trialEndsAt === 'number';
  const daysLeft = trialDaysLeft(trialEndsAt);

  return (
    <div
      className="flex h-full w-full items-center overflow-hidden"
      style={{ background: '#141414', color: '#fff' }}
      data-testid="paywall"
    >
      {/* Mascote — metade esquerda. */}
      <div
        className="flex flex-1 items-center justify-center border-0 border-r border-solid"
        style={{ borderColor: 'rgb(255 255 255 / 0.14)' }}
      >
        <HatLogo size={200} style={{ color: '#fff', maxHeight: '58%', width: 'auto' }} title="Hat" />
      </div>

      {/* Oferta — metade direita. */}
      <div className="flex flex-1 flex-col justify-center gap-4 px-[7%] py-6">
        <p className="m-0 leading-none" style={{ ...DIGITAL, fontSize: 'clamp(24px, 5vh, 44px)', letterSpacing: '0.06em' }}>
          ilimitado
        </p>
        <p className="m-0 max-w-[34ch] text-[13px] leading-relaxed" style={{ color: 'rgb(255 255 255 / 0.66)' }}>
          {everHadTrial && daysLeft === 0
            ? 'Seu período de teste terminou. Assine para continuar usando o Flash.'
            : 'Assine para usar o Flash sem limites.'}
        </p>

        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="rounded border border-[#007bff]/40 bg-[#007bff]/20 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-[#4da3ff]">
              DESCONTO ESPECIAL
            </span>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-[24px] opacity-40 line-through" style={{ color: 'rgb(255 255 255 / 0.5)' }}>
              R$50
            </span>
            <span className="leading-none tabular-nums text-[#007bff]" style={{ ...DIGITAL, fontSize: 'clamp(40px, 9vh, 72px)' }}>
              R$30
            </span>
            <span className="text-[12px]" style={{ color: 'rgb(255 255 255 / 0.5)' }}>
              /mês
            </span>
          </div>
        </div>

        <div className="mt-1 flex items-center gap-3">
          <button
            type="button"
            data-testid="paywall-subscribe"
            onClick={onSubscribe}
            className="hat-btn hat-btn-blue px-7 py-3 font-mono tracking-[0.04em]"
          >
            Assinar →
          </button>
          <span className="font-mono text-[10px] tracking-[0.1em] uppercase" style={{ color: 'rgb(255 255 255 / 0.4)' }}>
            checkout seguro
          </span>
        </div>
      </div>
    </div>
  );
}
