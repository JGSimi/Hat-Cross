import { useEffect, useRef, useState } from 'react';
import { listen, emit } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window';
import type { FlashTiming, FlashAppearance } from '../types';

interface FlashShowPayload {
  text: string;
  timing: FlashTiming;
  appearance: FlashAppearance;
  streamId: number;
}

interface ChatStreamChunk {
  streamId: number;
  text: string;
  isFinished: boolean;
  contentType?: string;
}

type Phase = 'hidden' | 'in' | 'hold' | 'out';

const FONT_STACK =
  "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Segoe UI Variable', " +
  "Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif";

// ~200 WPM reading speed → 300ms per word, bounded [1.5s, 12s].
function computeAutoHoldMs(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1500, Math.min(12000, words * 300));
}

export default function FlashPage() {
  const [mode, setMode] = useState<'show' | 'adjust' | 'idle'>('idle');
  const [displayedText, setDisplayedText] = useState('');
  const [timing, setTiming] = useState<FlashTiming | null>(null);
  const [appearance, setAppearance] = useState<FlashAppearance | null>(null);
  const [phase, setPhase] = useState<Phase>('hidden');

  const currentStreamId = useRef<number | null>(null);
  const timingRef = useRef<FlashTiming | null>(null);
  const timersRef = useRef<number[]>([]);
  const textRef = useRef<HTMLDivElement>(null);
  // Buffer chunks that arrive before `flash-show` (race between emit + mount).
  const pendingChunks = useRef<Map<number, string>>(new Map());
  const pendingFinished = useRef<Set<number>>(new Set());
  const resizeTimeoutRef = useRef<number | null>(null);

  const clearTimers = () => {
    timersRef.current.forEach((id) => clearTimeout(id));
    timersRef.current = [];
  };

  const schedule = (cb: () => void, ms: number) => {
    const id = window.setTimeout(cb, ms);
    timersRef.current.push(id);
  };

  // Debounced window-size fit — during typewriter streams chunks arrive every
  // few ms; calling setSize per chunk hammers the compositor on Windows/Linux.
  const fitWindowToContent = () => {
    if (resizeTimeoutRef.current !== null) {
      window.clearTimeout(resizeTimeoutRef.current);
    }
    resizeTimeoutRef.current = window.setTimeout(() => {
      resizeTimeoutRef.current = null;
      const el = textRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      // Clamp generously — narrow min so short replies stay tight, wide max so
      // long single-line responses don't pre-wrap before the window can grow.
      const w = Math.max(120, Math.min(1400, Math.ceil(rect.width) + 16));
      const h = Math.max(24, Math.min(600, Math.ceil(rect.height) + 12));
      getCurrentWindow()
        .setSize(new LogicalSize(w, h))
        .catch(() => {});
    }, 50);
  };

  useEffect(() => {
    const unlistens: Array<() => void> = [];

    listen<FlashShowPayload>('flash-show', (event) => {
      clearTimers();
      const payload = event.payload;
      currentStreamId.current = payload.streamId;
      timingRef.current = payload.timing;
      setMode('show');
      setTiming(payload.timing);
      setAppearance(payload.appearance);

      const isTypewriter = payload.timing.mode === 'typewriter';

      // Drain any chunks that arrived before this event (race condition).
      const buffered = pendingChunks.current.get(payload.streamId) ?? '';
      const wasFinished = pendingFinished.current.has(payload.streamId);
      pendingChunks.current.delete(payload.streamId);
      pendingFinished.current.delete(payload.streamId);

      setDisplayedText(isTypewriter ? buffered : payload.text);
      setPhase('in');

      if (payload.timing.mode === 'instant') {
        const hold = payload.timing.holdMs ?? computeAutoHoldMs(payload.text);
        schedule(() => setPhase('out'), hold);
        schedule(() => {
          setPhase('hidden');
          invoke('flash_hide').catch(() => {});
        }, hold + 16);
      } else if (payload.timing.mode === 'fade') {
        const fadeIn = payload.timing.fadeInMs;
        const hold = payload.timing.holdMs ?? computeAutoHoldMs(payload.text);
        const fadeOut = payload.timing.fadeOutMs;
        schedule(() => setPhase('hold'), fadeIn);
        schedule(() => setPhase('out'), fadeIn + hold);
        schedule(() => {
          setPhase('hidden');
          invoke('flash_hide').catch(() => {});
        }, fadeIn + hold + fadeOut);
      } else if (isTypewriter && wasFinished) {
        // Stream already finished before we mounted — fade out on the
        // buffered text now.
        const hold = payload.timing.holdMs ?? computeAutoHoldMs(buffered);
        schedule(() => setPhase('out'), hold);
        schedule(() => {
          setPhase('hidden');
          invoke('flash_hide').catch(() => {});
        }, hold + payload.timing.fadeOutMs);
      }
      fitWindowToContent();
    }).then((u) => unlistens.push(u));

    listen<ChatStreamChunk>('chat-stream', (event) => {
      if (event.payload.contentType === 'thinking') return;
      const chunkStream = event.payload.streamId;

      // If we're the active typewriter stream, apply live.
      if (
        currentStreamId.current === chunkStream &&
        timingRef.current?.mode === 'typewriter'
      ) {
        if (!event.payload.isFinished && event.payload.text) {
          setDisplayedText((prev) => prev + event.payload.text);
          fitWindowToContent();
        }
        if (event.payload.isFinished) {
          const timingNow = timingRef.current!;
          setDisplayedText((prev) => {
            const hold = timingNow.holdMs ?? computeAutoHoldMs(prev);
            schedule(() => setPhase('out'), hold);
            schedule(() => {
              setPhase('hidden');
              invoke('flash_hide').catch(() => {});
            }, hold + timingNow.fadeOutMs);
            return prev;
          });
        }
        return;
      }

      // Otherwise buffer for a later flash-show that references this stream.
      if (!event.payload.isFinished && event.payload.text) {
        const existing = pendingChunks.current.get(chunkStream) ?? '';
        pendingChunks.current.set(chunkStream, existing + event.payload.text);
      }
      if (event.payload.isFinished) {
        pendingFinished.current.add(chunkStream);
      }
    }).then((u) => unlistens.push(u));

    listen<void>('flash-adjust-enter', () => {
      clearTimers();
      setMode('adjust');
      setPhase('in');
      getCurrentWindow()
        .setSize(new LogicalSize(260, 110))
        .catch(() => {});
    }).then((u) => unlistens.push(u));

    return () => {
      clearTimers();
      if (resizeTimeoutRef.current !== null) {
        window.clearTimeout(resizeTimeoutRef.current);
      }
      unlistens.forEach((u) => u());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mode === 'show') fitWindowToContent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayedText, appearance?.fontSizePx, mode]);

  const handleSavePosition = async () => {
    try {
      const pos = await getCurrentWindow().outerPosition();
      await emit('flash-position-saved', { x: pos.x, y: pos.y });
    } catch (e) {
      console.error('[flash] save position failed:', e);
    }
    await invoke('flash_exit_adjust_mode').catch(() => {});
    setMode('idle');
    setPhase('hidden');
  };

  const handleCancelAdjust = async () => {
    await invoke('flash_exit_adjust_mode').catch(() => {});
    setMode('idle');
    setPhase('hidden');
  };

  const effectiveColor =
    appearance?.color && appearance.color.length > 0
      ? appearance.color
      : 'var(--color-accent, #A78BFA)';

  const textOpacity = appearance ? appearance.opacity / 100 : 0.35;

  const shadow = appearance?.textShadow
    ? '0 1px 2px rgba(0,0,0,0.55), 0 0 1px rgba(255,255,255,0.25)'
    : 'none';

  const transitionMs =
    phase === 'in'
      ? timing?.mode === 'instant'
        ? 0
        : (timing?.fadeInMs ?? 300)
      : phase === 'out'
      ? timing?.mode === 'instant'
        ? 0
        : (timing?.fadeOutMs ?? 500)
      : 0;

  const visibleOpacity =
    phase === 'hidden' || phase === 'out'
      ? 0
      : mode === 'adjust'
      ? 1
      : textOpacity;

  if (mode === 'idle' && phase === 'hidden') {
    return <div style={{ width: '100%', height: '100%' }} />;
  }

  if (mode === 'adjust') {
    return (
      <div
        style={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          justifyContent: 'center',
          gap: 8,
          padding: 10,
          background: 'rgba(20, 18, 28, 0.92)',
          borderRadius: 10,
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
          color: '#EDE9FE',
          fontFamily: FONT_STACK,
          fontSize: 11,
          boxSizing: 'border-box',
        }}
      >
        <div
          data-tauri-drag-region
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'move',
            userSelect: 'none',
            textAlign: 'center',
            opacity: 0.85,
          }}
        >
          Arraste para posicionar
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={handleCancelAdjust}
            style={{
              flex: 1,
              background: 'rgba(255,255,255,0.06)',
              color: '#EDE9FE',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 6,
              padding: '6px 10px',
              fontSize: 10.5,
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSavePosition}
            style={{
              flex: 1,
              background: '#A78BFA',
              color: '#110E18',
              border: 'none',
              borderRadius: 6,
              padding: '6px 10px',
              fontSize: 10.5,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Salvar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: 'transparent',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        pointerEvents: 'none',
        boxSizing: 'border-box',
        overflow: 'visible',
      }}
    >
      <div
        ref={textRef}
        style={{
          padding: '6px 8px',
          fontFamily: FONT_STACK,
          fontSize: appearance?.fontSizePx ?? 14,
          lineHeight: 1.35,
          color: effectiveColor,
          opacity: visibleOpacity,
          textShadow: shadow,
          transition: `opacity ${transitionMs}ms ease`,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          // Intrinsic width + absolute cap so the element measures at its
          // natural size (not clipped by the current window viewport), letting
          // the resize pass catch up on the next frame.
          width: 'max-content',
          maxWidth: 1200,
        }}
      >
        {displayedText || '\u00A0'}
      </div>
    </div>
  );
}

