import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useSettingsStore } from '../../stores/settingsStore';

/**
 * Soft ambient accent-colored bubbles that float slowly in the background.
 * They give depth to the glassmorphism UI and prevent the background from
 * looking flat. Each bubble drifts on its own slow orbit using CSS keyframes
 * generated per-bubble so the pattern never looks repetitive.
 *
 * Respects performance settings: disabled when `disableAnimatedGradients` is on.
 */

interface BubbleConfig {
  id: number;
  size: number;       // px diameter
  x: number;          // initial left %
  y: number;          // initial top %
  blur: number;       // px blur radius
  opacity: number;    // 0-1
  duration: number;   // seconds for one drift cycle
  delay: number;      // animation delay
  driftX: number;     // % horizontal drift amplitude
  driftY: number;     // % vertical drift amplitude
  scale: [number, number]; // min/max scale pulse
}

// Pre-defined bubble configurations — carefully placed to avoid clustering
const BUBBLES: BubbleConfig[] = [
  // Large ambient — top area
  { id: 1, size: 400, x: 15, y: -5, blur: 140, opacity: 0.045, duration: 28, delay: 0, driftX: 8, driftY: 6, scale: [1, 1.08] },
  // Medium — center-right
  { id: 2, size: 280, x: 70, y: 25, blur: 110, opacity: 0.05, duration: 24, delay: -6, driftX: 10, driftY: 8, scale: [0.95, 1.05] },
  // Small accent — bottom-left
  { id: 3, size: 180, x: 10, y: 65, blur: 80, opacity: 0.055, duration: 20, delay: -10, driftX: 6, driftY: 10, scale: [1, 1.1] },
  // Large soft — bottom-right corner
  { id: 4, size: 350, x: 80, y: 75, blur: 130, opacity: 0.04, duration: 32, delay: -4, driftX: 7, driftY: 5, scale: [0.96, 1.04] },
  // Small vibrant — top-right
  { id: 5, size: 150, x: 85, y: 5, blur: 70, opacity: 0.06, duration: 18, delay: -8, driftX: 12, driftY: 8, scale: [1, 1.12] },
  // Medium — center-left
  { id: 6, size: 220, x: 35, y: 40, blur: 100, opacity: 0.035, duration: 26, delay: -14, driftX: 9, driftY: 7, scale: [0.98, 1.06] },
];

function Bubble({ config }: { config: BubbleConfig }) {
  // Each bubble gets a unique animation with organic multi-point drift
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
        background: 'var(--color-accent)',
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

export default function AmbientBubbles() {
  const disableGradients = useSettingsStore(
    (s) => s.settings.performance?.disableAnimatedGradients,
  );
  const disableMouse = useSettingsStore(
    (s) => s.settings.performance?.disableMouseBackground,
  );

  // If animated gradients are disabled, render static (no animation) bubbles
  // so the background still has depth but no GPU cost from animation
  if (disableGradients && disableMouse) return null;

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
      {BUBBLES.map((bubble) =>
        disableGradients ? (
          // Static version — no animation, just positioned blobs
          <div
            key={bubble.id}
            style={{
              position: 'absolute',
              left: `${bubble.x}%`,
              top: `${bubble.y}%`,
              width: bubble.size,
              height: bubble.size,
              borderRadius: '50%',
              background: 'var(--color-accent)',
              filter: `blur(${bubble.blur}px)`,
              opacity: bubble.opacity,
              pointerEvents: 'none',
              transform: 'translate(-50%, -50%)',
            }}
            aria-hidden="true"
          />
        ) : (
          <Bubble key={bubble.id} config={bubble} />
        ),
      )}
    </div>
  );
}
