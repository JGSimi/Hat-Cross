import { useEffect, useRef, useState } from 'react';
import type { NativeBridge } from '../bridge/native';
import type { FlashShowPayload } from '../bridge/types';
import { holdMsFor } from '../domain/flash/timing';
import { friendlyErrorMessage } from '../domain/stream/errorMessages';

interface FlashPageProps {
  bridge: NativeBridge;
}

/**
 * Card do flash. A janela já existe (pré-aquecida pelo Rust); este componente
 * só reage a flash:show / stream:chunk e se auto-esconde após o hold.
 */
export function FlashPage({ bridge }: FlashPageProps) {
  const [payload, setPayload] = useState<FlashShowPayload | null>(null);
  const [streamText, setStreamText] = useState('');
  const [errorText, setErrorText] = useState<string | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const offShow = bridge.on('flash:show', (p) => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setStreamText('');
      setErrorText(null);
      setPayload(p);
    });
    const offChunk = bridge.on('stream:chunk', (chunk) => {
      if (chunk.contentType !== 'text') return;
      // O Rust emite o erro como um chunk final de texto no formato
      // `error:<code>:…` — traduzimos para uma mensagem limpa em vez de
      // despejar o JSON cru do upstream no card.
      const friendly = chunk.text ? friendlyErrorMessage(chunk.text) : null;
      if (friendly !== null) {
        setErrorText(friendly);
        setPayload((prev) => (prev ? { ...prev, state: 'answer' } : prev));
        return;
      }
      if (chunk.text) setStreamText((prev) => prev + chunk.text);
      if (chunk.isFinished) {
        setPayload((prev) => (prev ? { ...prev, state: 'answer' } : prev));
      }
    });
    const offHide = bridge.on('flash:hide', () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setPayload(null);
    });
    return () => {
      offShow();
      offChunk();
      offHide();
    };
  }, [bridge]);

  const text = errorText ?? streamText ?? payload?.text ?? '';
  const isAnswer = payload?.state === 'answer';

  useEffect(() => {
    if (!isAnswer) return;
    hideTimer.current = setTimeout(() => {
      setPayload(null);
      void bridge.flashHide();
    }, holdMsFor(text.length));
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [isAnswer, text.length, bridge]);

  if (!payload) return null;

  // Stealth: opacidade baixíssima por padrão (só o usuário sabe onde está),
  // com um piso para continuar legível de perto. 0–100 → fração.
  const cardOpacity = Math.max(0.12, Math.min(1, (payload.opacity ?? 16) / 100));
  // Textos longos: fonte menor e mais linhas. Curto = confortável.
  const long = text.length > 280;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'flex-start',
        padding: 8,
        pointerEvents: 'none',
        opacity: cardOpacity,
      }}
    >
      <div
        data-testid="flash-card"
        style={{
          // Fundo quase transparente: o contraste vem do texto, não de um
          // bloco opaco que denunciaria a posição.
          background: 'rgba(9, 9, 8, 0.35)',
          color: errorText ? 'var(--color-divergence)' : '#f6f6f4',
          borderRadius: 10,
          padding: long ? '8px 12px' : '10px 14px',
          fontSize: long ? 12 : 13.5,
          lineHeight: 1.42,
          maxWidth: 'min(92vw, 460px)',
          maxHeight: '92vh',
          overflow: 'hidden',
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
          textShadow: '0 1px 2px rgba(0,0,0,0.55)',
        }}
      >
        {payload.state === 'processing' && !streamText && !errorText
          ? 'Processando…'
          : text}
      </div>
    </div>
  );
}
