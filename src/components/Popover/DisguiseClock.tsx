import { useState, useEffect, useMemo, useRef, type KeyboardEvent } from 'react';
import { motion } from 'framer-motion';
import { usePlatform, type Platform } from '../../hooks/usePlatform';

interface DisguiseClockProps {
  /** Called when the user intentionally reveals the real window
   * (double-click anywhere on the clock, or keyboard Enter / Space
   * while the clock has focus). Single clicks are NO-OP by design —
   * they guard against a passing observer brushing the trackpad
   * (heuristic C2). */
  onReveal?: () => void;
}

interface ClockStyle {
  font: string;
  timeSize: number;
  timeWeight: number;
  timeLetterSpacing: number;
  secondsSize: number;
  dateSize: number;
  dateTransform: 'none' | 'lowercase' | 'uppercase';
}

const PLATFORM_STYLE: Record<Platform, ClockStyle> = {
  macos: {
    font: "-apple-system, 'SF Pro Display', BlinkMacSystemFont, 'Helvetica Neue', sans-serif",
    timeSize: 64,
    timeWeight: 200,
    timeLetterSpacing: -2,
    secondsSize: 18,
    dateSize: 13,
    dateTransform: 'none',
  },
  windows: {
    font: "'Segoe UI Variable Display', 'Segoe UI', Arial, sans-serif",
    timeSize: 64,
    timeWeight: 250,
    timeLetterSpacing: -1.2,
    secondsSize: 18,
    dateSize: 13,
    dateTransform: 'none',
  },
  linux: {
    font: "'Inter', 'Cantarell', 'Noto Sans', system-ui, sans-serif",
    timeSize: 64,
    timeWeight: 300,
    timeLetterSpacing: -1,
    secondsSize: 18,
    dateSize: 13,
    dateTransform: 'none',
  },
};

function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let tick: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (tick) return;
      tick = setInterval(() => setNow(new Date()), 1000);
    };
    const stop = () => {
      if (tick) {
        clearInterval(tick);
        tick = null;
      }
    };
    const onVisibility = () => (document.hidden ? stop() : start());
    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);
  return now;
}

function formatTimeParts(date: Date): { hours: string; minutes: string; seconds: string; hour12: boolean } {
  const resolved = new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions();
  const hour12 = resolved.hour12 ?? false;
  let h = date.getHours();
  if (hour12) {
    h = h % 12;
    if (h === 0) h = 12;
  }
  return {
    hours: String(h).padStart(2, '0'),
    minutes: String(date.getMinutes()).padStart(2, '0'),
    seconds: String(date.getSeconds()).padStart(2, '0'),
    hour12,
  };
}

function formatDate(date: Date): string {
  // Locale-aware date — matches whatever the OS is set to, no pt-only strings
  // leaking and giving the disguise away on a Windows EN install.
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(date);
}

export default function DisguiseClock({ onReveal }: DisguiseClockProps) {
  const platform = usePlatform();
  const style = useMemo(() => PLATFORM_STYLE[platform], [platform]);
  const now = useNow();
  const { hours, minutes, seconds } = formatTimeParts(now);
  const date = useMemo(() => formatDate(now), [now]);
  const rootRef = useRef<HTMLDivElement>(null);

  const handleDoubleClick = () => {
    onReveal?.();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onReveal?.();
    }
  };

  return (
    <motion.div
      ref={rootRef}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 350, damping: 28 }}
      data-tauri-drag-region
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label="Relógio"
      aria-keyshortcuts="Enter Space"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        width: '100%',
        background: 'var(--bg-primary)',
        borderRadius: 12,
        userSelect: 'none',
        // IMPORTANT: cursor stays default across the whole surface. Single
        // clicks must be NO-OP so a passing observer bumping the trackpad
        // never exposes the chat (heuristic C2). Reveal is gated behind
        // double-click OR keyboard Enter/Space while focused.
        cursor: 'default',
        outline: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 0 }}>
        <span
          style={{
            fontSize: style.timeSize,
            fontWeight: style.timeWeight,
            letterSpacing: style.timeLetterSpacing,
            color: 'var(--text-primary)',
            fontFamily: style.font,
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {hours}
        </span>
        <span
          style={{
            fontSize: style.timeSize,
            fontWeight: style.timeWeight,
            color: 'var(--text-primary)',
            fontFamily: style.font,
            lineHeight: 1,
            margin: '0 2px',
          }}
        >
          :
        </span>
        <span
          style={{
            fontSize: style.timeSize,
            fontWeight: style.timeWeight,
            letterSpacing: style.timeLetterSpacing,
            color: 'var(--text-primary)',
            fontFamily: style.font,
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {minutes}
        </span>
        <span
          style={{
            fontSize: style.secondsSize,
            fontWeight: 300,
            color: 'var(--text-muted)',
            fontFamily: style.font,
            lineHeight: 1,
            marginLeft: 6,
            alignSelf: 'flex-end',
            marginBottom: 6,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {seconds}
        </span>
      </div>

      <div
        style={{
          marginTop: 8,
          fontSize: style.dateSize,
          fontWeight: 400,
          color: 'var(--text-muted)',
          letterSpacing: 0.2,
          fontFamily: style.font,
          textTransform: style.dateTransform,
        }}
      >
        {date}
      </div>
    </motion.div>
  );
}
