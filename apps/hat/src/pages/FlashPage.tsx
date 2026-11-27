import { useEffect, useRef, useState } from 'react';
import type { NativeBridge } from '../bridge/native';
import type { FlashShowPayload } from '../bridge/types';
import { anchorOf, scrollPlan, type ScrollPlan } from '../domain/flash/area';
import { friendlyErrorMessage } from '../domain/stream/errorMessages';

function samePlan(a: ScrollPlan, b: ScrollPlan): boolean {
  return a.scroll === b.scroll && a.distancePx === b.distancePx && a.holdMs === b.holdMs;
}

/** Quanto tempo o contorno da área fica na tela na prévia. */
const PREVIEW_MS = 2500;

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
  const cardRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [plan, setPlan] = useState<ScrollPlan | null>(null);
  const copiedRef = useRef(false);

  useEffect(() => {
    const offShow = bridge.on('flash:show', (p) => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setStreamText('');
      setErrorText(null);
      copiedRef.current = false;
      setPlan(null);
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
      setPlan(null);
      setPayload(null);
    });
    return () => {
      offShow();
      offChunk();
      offHide();
    };
  }, [bridge]);

  // Stream tem prioridade; sem stream (correção da sala) vale o texto pronto.
  const text = errorText ?? (streamText || payload?.text || '');
  const isAnswer = payload?.state === 'answer';
  const isProcessing = payload?.state === 'processing';
  const isPreview = payload?.state === 'preview';

  // Resposta da IA → clipboard (uma vez por flash), para o usuário colar.
  // Só respostas reais (não erro, não estado de correção sem stream local).
  useEffect(() => {
    if (isAnswer && !errorText && streamText.trim() && !copiedRef.current) {
      copiedRef.current = true;
      void bridge.writeClipboard(streamText.trim()).catch(() => {});
    }
  }, [isAnswer, errorText, streamText, bridge]);

  // Tamanho FIXO: a janela é a área que o usuário escolheu. Quando a
  // resposta termina e não cabe, ela rola sozinha (a janela é click-through,
  // ninguém rola com o mouse) e o tempo na tela cresce para dar para ler.
  // `payload` nas dependências: um novo show reinicia o plano mesmo com o
  // mesmo texto (senão o timer de esconder nunca volta). Mede de novo no
  // próximo frame e quando a janela muda de tamanho (o nativo faz set_size
  // logo antes de emitir o show).
  useEffect(() => {
    if (!isAnswer) return;
    const measure = () => {
      const overflow = (contentRef.current?.scrollHeight ?? 0) - (cardRef.current?.clientHeight ?? 0);
      const next = scrollPlan(overflow, text.length);
      setPlan((prev) => (prev && samePlan(prev, next) ? prev : next));
    };
    measure();
    const frame = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', measure);
    };
  }, [isAnswer, text, payload]);

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
    if (!isAnswer || !plan) return;
    hideTimer.current = setTimeout(() => {
      setPayload(null);
      void bridge.flashHide();
    }, plan.holdMs);
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [isAnswer, plan, bridge]);

  // Prévia da área (vinda do ajuste na tela principal): some sozinha.
  useEffect(() => {
    if (!isPreview) return;
    hideTimer.current = setTimeout(() => {
      setPayload(null);
      void bridge.flashHide();
    }, PREVIEW_MS);
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [isPreview, payload, bridge]);

  if (!payload) return null;

  if (isPreview) {
    return (
      <div
        role="status"
        aria-live="polite"
        data-testid="flash-area-preview"
        style={{
          position: 'fixed',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          pointerEvents: 'none',
          border: '2px solid #b5d334',
          borderRadius: 12,
          background: 'rgba(181, 211, 52, 0.14)',
          boxSizing: 'border-box',
        }}
      >
        <span
          style={{
            background: 'rgba(9, 9, 8, 0.78)',
            color: '#f6f6f4',
            fontSize: 13,
            padding: '6px 12px',
            borderRadius: 999,
          }}
        >
          O Hat responde aqui
        </span>
      </div>
    );
  }

  const anchor = payload.area ? anchorOf(payload.area) : { horizontal: 'left', vertical: 'top' };
  const scrolling = plan?.scroll === true;

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
        justifyContent: anchor.horizontal === 'right' ? 'flex-end' : 'flex-start',
        alignItems: anchor.vertical === 'bottom' ? 'flex-end' : 'flex-start',
        padding: 8,
        boxSizing: 'border-box',
        pointerEvents: 'none',
        opacity: cardOpacity,
      }}
    >
      <div
        ref={cardRef}
        data-testid="flash-card"
        style={{
          // Fundo configurável; quando desligado, só o texto aparece (mais
          // furtivo). A opacidade do wrapper já controla a discrição geral.
          background: showBg ? hexToRgba(bgColor, 0.35) : 'transparent',
          color: textColor,
          borderRadius: 10,
          fontSize: long ? 12 : 13.5,
          lineHeight: 1.42,
          // Nunca passa da área: a janela já tem o tamanho escolhido.
          maxWidth: '100%',
          maxHeight: '100%',
          overflow: 'hidden',
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
          textShadow: '0 1px 2px rgba(0,0,0,0.55)',
        }}
      >
        <div
          ref={contentRef}
          data-testid="flash-content"
          style={{
            padding: long ? '8px 12px' : '10px 14px',
            transform: scrolling ? `translateY(-${plan.distancePx}px)` : undefined,
            transition: scrolling
              ? `transform ${plan.durationMs}ms linear ${plan.delayMs}ms`
              : undefined,
            willChange: scrolling ? 'transform' : undefined,
          }}
        >
          {payload.state === 'processing' && !streamText && !errorText
            ? 'Processando…'
            : text}
        </div>
      </div>
    </div>
  );
}
