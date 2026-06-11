import { useEffect, useState } from 'react';
import type { NativeBridge } from '../bridge/native';
import type { GabaritoShowPayload } from '../bridge/types';

interface GabaritoPageProps {
  bridge: NativeBridge;
}

function hexToRgba(hex: string, alpha: number): string {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return hex;
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/**
 * Overlay do gabarito: persistente (não auto-some), abaixo do flash, mesma
 * config visual. Lista as respostas corrigidas da sala. Some via atalho
 * (a janela é escondida pelo Rust; aqui só renderizamos o conteúdo).
 */
export function GabaritoPage({ bridge }: GabaritoPageProps) {
  const [payload, setPayload] = useState<GabaritoShowPayload | null>(null);

  useEffect(() => {
    const off = bridge.on('gabarito:show', setPayload);
    return off;
  }, [bridge]);

  if (!payload) return null;

  const opacity = Math.max(0.12, Math.min(1, (payload.opacity ?? 16) / 100));
  const showBg = payload.background ?? true;
  const bgColor = payload.bgColor ?? '#090908';
  const textColor = payload.textColor ?? '#f6f6f4';

  return (
    <div
      role="status"
      aria-live="polite"
      style={{ position: 'fixed', inset: 0, padding: 8, pointerEvents: 'none', opacity }}
    >
      <div
        data-testid="gabarito-card"
        style={{
          background: showBg ? hexToRgba(bgColor, 0.4) : 'transparent',
          color: textColor,
          borderRadius: 10,
          padding: '8px 12px',
          fontSize: 12,
          lineHeight: 1.4,
          maxWidth: 'min(92vw, 460px)',
          maxHeight: '100%',
          overflow: 'hidden',
          textShadow: '0 1px 2px rgba(0,0,0,0.55)',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            opacity: 0.6,
            marginBottom: 4,
          }}
        >
          Gabarito da sala
        </div>
        {payload.items.length === 0 ? (
          <div style={{ opacity: 0.7 }}>Ainda sem respostas apuradas.</div>
        ) : (
          payload.items.map((item, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: 8,
                padding: '2px 0',
                borderTop: i > 0 ? '1px solid rgba(255,255,255,0.08)' : undefined,
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  whiteSpace: 'nowrap',
                  color: item.diverged ? 'var(--color-divergence)' : undefined,
                  fontWeight: 600,
                }}
              >
                {item.answer}
              </span>
              <span style={{ opacity: 0.85, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.question}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
