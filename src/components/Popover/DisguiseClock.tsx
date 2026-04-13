import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSettingsStore } from '../../stores/settingsStore';

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function formatDate(date: Date): string {
  const weekday = WEEKDAYS[date.getDay()];
  const day = date.getDate();
  const month = MONTHS[date.getMonth()];
  return `${weekday}, ${day} ${month}`;
}

export default function DisguiseClock() {
  const reducedMotion = useSettingsStore((s) => s.settings.performance.reducedMotion);
  const [now, setNow] = useState(() => new Date());
  const [colonVisible, setColonVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
      setColonVisible((v) => !v);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  const animationProps = reducedMotion
    ? { initial: { opacity: 1 }, animate: { opacity: 1 }, transition: { duration: 0.01 } }
    : { initial: { opacity: 0, scale: 0.95 }, animate: { opacity: 1, scale: 1 }, transition: { type: 'spring' as const, stiffness: 350, damping: 28 } };

  return (
    <motion.div
      {...animationProps}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        width: '100%',
        background: 'var(--glass-primary)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        userSelect: 'none',
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
