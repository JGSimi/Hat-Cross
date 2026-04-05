import { useEffect } from 'react';
import { motion, useMotionValue, useSpring, useMotionTemplate } from 'framer-motion';

interface LayerConfig {
  size: number;
  opacity: number;
  spring: { stiffness: number; damping: number; mass: number };
}

const LAYERS: LayerConfig[] = [
  { size: 600, opacity: 12, spring: { stiffness: 30, damping: 18, mass: 0.8 } },
  { size: 350, opacity: 18, spring: { stiffness: 80, damping: 22, mass: 0.4 } },
  { size: 180, opacity: 10, spring: { stiffness: 150, damping: 26, mass: 0.2 } },
];

function GlowLayer({
  config,
  mouseX,
  mouseY,
  visible,
}: {
  config: LayerConfig;
  mouseX: ReturnType<typeof useMotionValue<number>>;
  mouseY: ReturnType<typeof useMotionValue<number>>;
  visible: ReturnType<typeof useMotionValue<number>>;
}) {
  const { size, opacity, spring } = config;

  const smoothX = useSpring(mouseX, spring);
  const smoothY = useSpring(mouseY, spring);
  const smoothOpacity = useSpring(visible, { stiffness: 60, damping: 20 });

  const background = useMotionTemplate`
    radial-gradient(${size}px circle at ${smoothX}px ${smoothY}px,
      color-mix(in srgb, var(--color-accent) ${opacity}%, transparent),
      transparent 70%)
  `;

  return (
    <motion.div
      style={{
        position: 'absolute',
        inset: 0,
        background,
        opacity: smoothOpacity,
        pointerEvents: 'none',
        zIndex: 0,
      }}
      aria-hidden="true"
    />
  );
}

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

    const handleLeave = () => {
      visible.set(0);
    };

    const handleEnter = () => {
      visible.set(1);
    };

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
    <>
      {LAYERS.map((layer, i) => (
        <GlowLayer
          key={i}
          config={layer}
          mouseX={mouseX}
          mouseY={mouseY}
          visible={visible}
        />
      ))}
    </>
  );
}
