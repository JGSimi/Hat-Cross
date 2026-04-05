import { useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform, type MotionValue } from 'framer-motion';

/* ── Config ──────────────────────────────────────────────────────── */

interface BlobConfig {
  diameter: number;
  blur: number;
  opacity: number;
  spring: { stiffness: number; damping: number; mass: number };
  stretchAlong: number;
  stretchPerp: number;
}

const MAX_DELTA = 150;

const LAYERS: BlobConfig[] = [
  { diameter: 350, blur: 120, opacity: 0.07, spring: { stiffness: 30, damping: 18, mass: 0.8 }, stretchAlong: 0.35, stretchPerp: 0.12 },
  { diameter: 200, blur: 80,  opacity: 0.09, spring: { stiffness: 80, damping: 22, mass: 0.4 }, stretchAlong: 0.25, stretchPerp: 0.08 },
  { diameter: 100, blur: 50,  opacity: 0.05, spring: { stiffness: 150, damping: 26, mass: 0.2 }, stretchAlong: 0.15, stretchPerp: 0.05 },
];

/* ── Blob Layer ──────────────────────────────────────────────────── */

function BlobLayer({
  config,
  mouseX,
  mouseY,
  visible,
}: {
  config: BlobConfig;
  mouseX: MotionValue<number>;
  mouseY: MotionValue<number>;
  visible: MotionValue<number>;
}) {
  const { diameter, blur, opacity, spring, stretchAlong, stretchPerp } = config;

  const smoothX = useSpring(mouseX, spring);
  const smoothY = useSpring(mouseY, spring);
  const smoothVisible = useSpring(visible, { stiffness: 60, damping: 20 });

  const combinedOpacity = useTransform(smoothVisible, (v) => v * opacity);

  const transform = useTransform(
    [smoothX, smoothY, mouseX, mouseY] as MotionValue<number>[],
    ([sx, sy, mx, my]: number[]) => {
      const dx = mx - sx;
      const dy = my - sy;
      const speed = Math.sqrt(dx * dx + dy * dy);
      const t = Math.min(speed / MAX_DELTA, 1);
      const eased = t * t * (3 - 2 * t); // smoothstep

      const along = 1 + eased * stretchAlong;
      const perp = 1 - eased * stretchPerp;
      const deg = (Math.atan2(dy, dx) * 180) / Math.PI;

      return `translate(${sx}px, ${sy}px) translate(-50%, -50%) rotate(${deg}deg) scale(${along}, ${perp}) rotate(${-deg}deg)`;
    },
  );

  return (
    <motion.div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: diameter,
        height: diameter,
        borderRadius: '50%',
        background: 'var(--color-accent)',
        filter: `blur(${blur}px)`,
        opacity: combinedOpacity,
        transform,
        willChange: 'transform, opacity',
        pointerEvents: 'none',
      }}
      aria-hidden="true"
    />
  );
}

/* ── Container ───────────────────────────────────────────────────── */

export default function MouseReactiveBackground() {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const visible = useMotionValue(0);

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
      if (visible.get() === 0) visible.set(1);
    };

    const handleLeave = () => visible.set(0);
    const handleEnter = () => visible.set(1);

    window.addEventListener('mousemove', handleMove, { passive: true });
    document.documentElement.addEventListener('mouseleave', handleLeave);
    document.documentElement.addEventListener('mouseenter', handleEnter);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      document.documentElement.removeEventListener('mouseleave', handleLeave);
      document.documentElement.removeEventListener('mouseenter', handleEnter);
    };
  }, [mouseX, mouseY, visible]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 0,
      }}
      aria-hidden="true"
    >
      {LAYERS.map((layer, i) => (
        <BlobLayer key={i} config={layer} mouseX={mouseX} mouseY={mouseY} visible={visible} />
      ))}
    </div>
  );
}
