import { HatLogo } from './HatLogo';

interface FarewellProps {
  /** Primeiro nome (quando conhecido) para a despedida ser pessoal. */
  name: string | null;
  /** Reabre o checkout (voltar a assinar). */
  onResubscribe: () => void;
}

/**
 * Despedida de quem cancelou: o acesso pausa NA HORA, mas a porta fica aberta.
 * Sem culpa, sem dark pattern. Redesign na linguagem da HatHome (#141414, azul),
 * centrado e compacto para a janela curta.
 */
export function Farewell({ name, onResubscribe }: FarewellProps) {
  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center px-8 text-center"
      style={{ background: '#141414', color: '#fff' }}
      data-testid="farewell"
    >
      <span className="hat-avatar size-16" data-tier="none">
        <span className="flex size-16 items-center justify-center rounded-full" style={{ background: '#3d3d3d' }}>
          <HatLogo size={34} style={{ color: '#fff' }} />
        </span>
      </span>

      <h1 className="hat-rise m-0 mt-5 text-[30px] leading-tight font-light tracking-[-0.01em]">
        Foi bom ter você{name ? `, ${name}` : ''}.
      </h1>
      <p
        className="hat-rise m-0 mt-3 max-w-[46ch] text-[13px] leading-relaxed"
        style={{ color: 'rgb(255 255 255 / 0.62)', animationDelay: '90ms' }}
      >
        Sua assinatura terminou e o Flash e seu acesso ficaram em pausa agora.
        Seu histórico continua guardado, esperando por você.
      </p>

      <button
        type="button"
        data-testid="farewell-resubscribe"
        onClick={onResubscribe}
        className="hat-btn hat-btn-blue hat-rise mt-8 px-7 py-3 font-mono tracking-[0.04em]"
        style={{ animationDelay: '180ms' }}
      >
        Voltar para o ilimitado →
      </button>
      <p
        className="hat-rise m-0 mt-3 font-mono text-[10px] tracking-[0.12em] uppercase"
        style={{ color: 'rgb(255 255 255 / 0.4)', animationDelay: '180ms' }}
      >
        mudou de ideia? a porta abre na hora
      </p>
    </div>
  );
}
