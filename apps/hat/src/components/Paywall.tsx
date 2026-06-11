import { trialDaysLeft } from '../services/account';
import { HatLogo } from './HatLogo';

interface PaywallProps {
  trialEndsAt: number | null;
  onSubscribe: () => void;
}

/**
 * Tela de bloqueio quando o trial acabou e não há assinatura. Plano único:
 * R$50/mês, acesso ilimitado. Mantém a voz de instrumento do app.
 */
export function Paywall({ trialEndsAt, onSubscribe }: PaywallProps) {
  const everHadTrial = typeof trialEndsAt === 'number';
  const daysLeft = trialDaysLeft(trialEndsAt);

  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center" data-testid="paywall">
      <HatLogo size={56} className="text-text-secondary" />
      <h1 className="font-display mt-4 mb-0 text-[30px] leading-none font-extralight tracking-[-0.02em] text-text-primary">
        Hat ilimitado
      </h1>
      <p className="mt-3 mb-0 max-w-90 text-[13px] leading-relaxed text-text-secondary">
        {everHadTrial && daysLeft === 0
          ? 'Seu período de teste terminou. Assine para continuar com salas e o Flash.'
          : 'Assine para usar salas e o Flash sem limites.'}
      </p>

      <div className="mt-7 flex items-baseline gap-2">
        <span className="font-display text-[56px] leading-none font-extralight tracking-[-0.03em] text-text-primary tabular-nums">
          R$50
        </span>
        <span className="text-[13px] text-text-muted">/mês · ilimitado</span>
      </div>

      <button
        type="button"
        data-testid="paywall-subscribe"
        onClick={onSubscribe}
        className="hat-btn hat-btn-primary mt-7 px-7 py-3 font-mono tracking-[0.04em]"
      >
        Assinar →
      </button>
      <p className="mt-3 mb-0 font-mono text-[10px] tracking-[0.12em] text-text-muted uppercase">
        abre o checkout seguro no navegador
      </p>
    </div>
  );
}
