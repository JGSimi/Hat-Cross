import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function formatDate(date: Date): string {
  const weekday = WEEKDAYS[date.getDay()];
  const day = date.getDate();
  const month = MONTHS[date.getMonth()];
  return `${weekday}, ${day} ${month}`;
}

interface DisguiseClockProps {
  onReveal?: () => void;
}

export default function DisguiseClock({ onReveal }: DisguiseClockProps) {
  const [now, setNow] = useState(() => new Date());
  const [colonVisible, setColonVisible] = useState(true);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (interval) return;
      interval = setInterval(() => {
        setNow(new Date());
        setColonVisible((v) => !v);
      }, 1000);
    };
    const stop = () => {
      if (interval) { clearInterval(interval); interval = null; }
    };
    const onVisibility = () => document.hidden ? stop() : start();
    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 350, damping: 28 }}
      data-tauri-drag-region
      onClick={onReveal}
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
        cursor: 'pointer',
      }}
    >
      {/* Time display */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 0,
        }}
      >
        <span
          style={{
            fontSize: 64,
            fontWeight: 200,
            letterSpacing: -2,
            color: 'var(--color-accent)',
            fontFamily: "'General Sans', -apple-system, sans-serif",
            lineHeight: 1,
          }}
        >
          {hours}
        </span>
        <span
          style={{
            fontSize: 64,
            fontWeight: 200,
            color: 'var(--color-accent)',
            fontFamily: "'General Sans', -apple-system, sans-serif",
            lineHeight: 1,
            opacity: colonVisible ? 1 : 0.2,
            transition: 'opacity 0.15s ease',
            margin: '0 2px',
          }}
        >
          :
        </span>
        <span
          style={{
            fontSize: 64,
            fontWeight: 200,
            letterSpacing: -2,
            color: 'var(--color-accent)',
            fontFamily: "'General Sans', -apple-system, sans-serif",
            lineHeight: 1,
          }}
        >
          {minutes}
        </span>
        <span
          style={{
            fontSize: 20,
            fontWeight: 300,
            color: 'var(--text-muted)',
            fontFamily: "'General Sans', -apple-system, sans-serif",
            lineHeight: 1,
            marginLeft: 6,
            alignSelf: 'flex-end',
            marginBottom: 6,
          }}
        >
          {seconds}
        </span>
      </div>

      {/* Date display */}
      <div
        style={{
          marginTop: 8,
          fontSize: 13,
          fontWeight: 400,
          color: 'var(--text-muted)',
          letterSpacing: 1,
          textTransform: 'lowercase',
        }}
      >
        {formatDate(now)}
      </div>
    </motion.div>
  );
}
