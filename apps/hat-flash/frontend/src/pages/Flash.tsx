import { type CSSProperties, useEffect, useMemo } from 'react';
import { hat } from '../bridge/hat';
import { useHatStore } from '../stores/hatStore';

export function Flash() {
  const storePayload = useHatStore((s) => s.flashPayload);
  const previewPayload = useMemo(() => {
    if (!import.meta.env.DEV || !new URLSearchParams(window.location.search).has('mockFlash')) return null;
    return {
      text: 'Resposta pronta: Stripe funcionando, sala criada e captura de clipboard registrada com sucesso.',
      position: { x: 40, y: 40 },
      timing: { mode: 'fade', fadeInMs: 220, fadeOutMs: 420, holdMs: 4200 },
      appearance: { color: '', opacity: 92, fontSizePx: 15, textShadow: true },
      streamId: 0,
    };
  }, []);
  const payload = storePayload ?? previewPayload;

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

  const cardAlpha = Math.max(0.94, Math.min(0.99, payload.appearance.opacity / 100));
  const flashStyle = {
    '--flash-hold': `${holdMs}ms`,
    '--flash-card-alpha': String(cardAlpha),
  } as CSSProperties;

  return (
    <main className={`flash ${payload.timing.mode}`} style={flashStyle} onClick={() => hat.flash.hide()}>
      <section
        className="flash-card"
        style={{
          color: payload.appearance.color || '#fffaf2',
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
