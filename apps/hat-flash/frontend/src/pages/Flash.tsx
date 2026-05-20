import { type CSSProperties, useEffect, useMemo } from 'react';
import { hat } from '../bridge/hat';
import { useHatStore } from '../stores/hatStore';

export function Flash() {
  const payload = useHatStore((s) => s.flashPayload);

  const holdMs = useMemo(() => {
    if (!payload) return 1600;
    if (payload.timing.holdMs) return payload.timing.holdMs;
    return Math.max(1800, Math.min(6500, payload.text.length * 34));
  }, [payload]);

  useEffect(() => {
    if (!payload) return;
    const timer = window.setTimeout(() => {
      hat.flash.hide();
    }, holdMs);
    return () => window.clearTimeout(timer);
  }, [holdMs, payload]);

  if (!payload) return <main className="flash" aria-hidden="true" />;

  const flashStyle = {
    '--flash-x': `${payload.position.x}%`,
    '--flash-y': `${payload.position.y}%`,
    '--flash-hold': `${holdMs}ms`,
  } as CSSProperties;

  return (
    <main className={`flash ${payload.timing.mode}`} style={flashStyle} onClick={() => hat.flash.hide()}>
      <section
        className="flash-card"
        style={{
          color: payload.appearance.color || '#f8fafc',
          opacity: Math.max(0.55, payload.appearance.opacity / 100),
          fontSize: `clamp(14px, ${payload.appearance.fontSizePx}px, 34px)`,
          textShadow: payload.appearance.textShadow ? '0 2px 18px rgba(0,0,0,.9)' : 'none',
        }}
      >
        <div className="flash-text">{payload.text}</div>
        <div className="flash-progress" />
      </section>
    </main>
  );
}
