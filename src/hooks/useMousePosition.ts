import { useEffect } from 'react';
import { useMotionValue, useSpring, type MotionValue } from 'framer-motion';

const springConfig = { stiffness: 50, damping: 30, mass: 1 };

export function useMousePosition(): { x: MotionValue<number>; y: MotionValue<number> } {
  const rawX = useMotionValue(typeof window !== 'undefined' ? window.innerWidth / 2 : 0);
  const rawY = useMotionValue(typeof window !== 'undefined' ? window.innerHeight / 2 : 0);

  const x = useSpring(rawX, springConfig);
  const y = useSpring(rawY, springConfig);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      rawX.set(e.clientX);
      rawY.set(e.clientY);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [rawX, rawY]);

  return { x, y };
}
