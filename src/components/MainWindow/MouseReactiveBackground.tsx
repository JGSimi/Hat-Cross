import { useEffect } from 'react';
import { motion, useMotionValue, useSpring, useMotionTemplate } from 'framer-motion';

const LAYERS = [
  { size: 600, opacity: 5, spring: { stiffness: 30, damping: 18, mass: 0.8 } },
  { size: 350, opacity: 7, spring: { stiffness: 80, damping: 22, mass: 0.4 } },
  { size: 180, opacity: 4, spring: { stiffness: 150, damping: 26, mass: 0.2 } },
] as const;

function GlowLayer({ size, opacity, spring }: (typeof LAYERS)[number]) {
  const mouseX = useMotionValue(-size);
  const mouseY = useMotionValue(-size);

  const smoothX = useSpring(mouseX, spring);
  const smoothY = useSpring(mouseY, spring);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };
    window.addEventListener('mousemove', handler, { passive: true });
    return () => window.removeEventListener('mousemove', handler);
  }, [mouseX, mouseY]);

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
        pointerEvents: 'none',
        zIndex: 0,
        willChange: 'background',
      }}
      aria-hidden="true"
    />
  );
}

export default function MouseReactiveBackground() {
  return (
    <>
      {LAYERS.map((layer, i) => (
        <GlowLayer key={i} {...layer} />
      ))}
    </>
  );
}
