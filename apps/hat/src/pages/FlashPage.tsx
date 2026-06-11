import { useEffect, useRef, useState } from 'react';
import type { NativeBridge } from '../bridge/native';
import type { FlashShowPayload } from '../bridge/types';
import { holdMsFor } from '../domain/flash/timing';
import { friendlyErrorMessage } from '../domain/stream/errorMessages';

interface FlashPageProps {
  bridge: NativeBridge;
}

/** #rrggbb (ou #rgb) + alpha → rgba(). Fallback ao próprio valor se inválido. */
function hexToRgba(hex: string, alpha: number): string {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return hex;
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
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
  const isProcessing = payload?.state === 'processing';

  // Watchdog: o Flash NUNCA pode ficar preso em "Processando…". Se nada chegar
  // (token falhou, rede caiu, backend travou) em PROCESSING_TIMEOUT_MS, mostra
  // erro e segue para o auto-hide. Cancelado assim que chega texto/erro.
  useEffect(() => {
    if (!isProcessing || streamText || errorText) return;
    const id = setTimeout(() => {
      setErrorText('Sem resposta. Verifique sua conexão/login e tente de novo.');
      setPayload((prev) => (prev ? { ...prev, state: 'answer' } : prev));
    }, 15000);
    return () => clearTimeout(id);
  }, [isProcessing, streamText, errorText, payload]);

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
  const showBg = payload.background ?? true;
  const bgColor = payload.bgColor ?? '#090908';
  const textColor = errorText ? 'var(--color-divergence)' : (payload.textColor ?? '#f6f6f4');
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
          // Fundo configurável; quando desligado, só o texto aparece (mais
          // furtivo). A opacidade do wrapper já controla a discrição geral.
          background: showBg ? hexToRgba(bgColor, 0.35) : 'transparent',
          color: textColor,
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
