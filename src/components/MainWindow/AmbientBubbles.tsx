import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useSettingsStore } from '../../stores/settingsStore';

/**
 * Soft ambient accent-colored bubbles that float slowly in the background.
 * They give depth to the glassmorphism UI and prevent the background from
 * looking flat. Each bubble drifts on its own slow orbit.
 *
 * Respects performance settings: disabled when `disableAnimatedGradients` is on.
 */

interface BubbleConfig {
  id: number;
  size: number;
  x: number;
  y: number;
  blur: number;
  opacity: number;
  duration: number;
  delay: number;
  driftX: number;
  driftY: number;
  scale: [number, number];
}

const BUBBLES: BubbleConfig[] = [
  // Large — top-left area
  { id: 1, size: 450, x: 12, y: -8, blur: 120, opacity: 0.12, duration: 28, delay: 0, driftX: 8, driftY: 6, scale: [1, 1.06] },
  // Medium — center-right
  { id: 2, size: 320, x: 72, y: 22, blur: 100, opacity: 0.10, duration: 24, delay: -6, driftX: 10, driftY: 8, scale: [0.95, 1.05] },
  // Small — bottom-left
  { id: 3, size: 220, x: 8, y: 68, blur: 80, opacity: 0.13, duration: 20, delay: -10, driftX: 6, driftY: 10, scale: [1, 1.08] },
  // Large — bottom-right corner
  { id: 4, size: 400, x: 82, y: 78, blur: 110, opacity: 0.09, duration: 32, delay: -4, driftX: 7, driftY: 5, scale: [0.96, 1.04] },
  // Small vibrant — top-right
  { id: 5, size: 180, x: 88, y: 2, blur: 70, opacity: 0.14, duration: 18, delay: -8, driftX: 12, driftY: 8, scale: [1, 1.10] },
  // Medium — center
  { id: 6, size: 260, x: 38, y: 42, blur: 90, opacity: 0.08, duration: 26, delay: -14, driftX: 9, driftY: 7, scale: [0.98, 1.06] },
];

function Bubble({ config }: { config: BubbleConfig }) {
  const animVariants = useMemo(
    () => ({
      animate: {
        x: [
          0,
          config.driftX * 4,
          -config.driftX * 2,
          config.driftX * 3,
          -config.driftX * 1,
          0,
        ],
        y: [
          0,
          -config.driftY * 3,
          config.driftY * 2,
          -config.driftY * 1,
          config.driftY * 4,
          0,
        ],
        scale: [
          config.scale[0],
          config.scale[1],
          config.scale[0],
          config.scale[1],
          config.scale[0],
          config.scale[0],
        ],
      },
    }),
    [config],
  );

  return (
    <motion.div
      variants={animVariants}
      animate="animate"
      transition={{
        duration: config.duration,
        delay: config.delay,
        repeat: Infinity,
        repeatType: 'mirror',
        ease: 'easeInOut',
      }}
      style={{
        position: 'absolute',
        left: `${config.x}%`,
        top: `${config.y}%`,
        width: config.size,
        height: config.size,
        borderRadius: '50%',
        background: `radial-gradient(circle, var(--color-accent), transparent 70%)`,
        filter: `blur(${config.blur}px)`,
        opacity: config.opacity,
        willChange: 'transform',
        pointerEvents: 'none',
        transform: 'translate(-50%, -50%)',
      }}
      aria-hidden="true"
    />
  );
}

function StaticBubble({ config }: { config: BubbleConfig }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: `${config.x}%`,
        top: `${config.y}%`,
        width: config.size,
        height: config.size,
        borderRadius: '50%',
        background: `radial-gradient(circle, var(--color-accent), transparent 70%)`,
        filter: `blur(${config.blur}px)`,
        opacity: config.opacity,
        pointerEvents: 'none',
        transform: 'translate(-50%, -50%)',
      }}
      aria-hidden="true"
    />
  );
}

export default function AmbientBubbles() {
  const disableGradients = useSettingsStore(
    (s) => s.settings.performance?.disableAnimatedGradients,
  );
  const disableMouse = useSettingsStore(
    (s) => s.settings.performance?.disableMouseBackground,
  );

  if (disableGradients && disableMouse) return null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 1,
      }}
      aria-hidden="true"
    >
      {BUBBLES.map((bubble) =>
        disableGradients ? (
          <StaticBubble key={bubble.id} config={bubble} />
        ) : (
          <Bubble key={bubble.id} config={bubble} />
        ),
      )}
    </div>
  );
}
