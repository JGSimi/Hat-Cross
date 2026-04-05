import { memo, useEffect } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { useMousePosition } from '../../hooks/useMousePosition';

const GLOW_SIZE = 1000;
const HALF = GLOW_SIZE / 2;

export default memo(function MouseGlow() {
  const { x, y } = useMousePosition();
  const opacity = useMotionValue(1);

  const translateX = useTransform(x, (v) => v - HALF);
  const translateY = useTransform(y, (v) => v - HALF);

  useEffect(() => {
    const handleEnter = () => opacity.set(1);
    const handleLeave = () => opacity.set(0);

    document.addEventListener('mouseenter', handleEnter);
    document.addEventListener('mouseleave', handleLeave);
    return () => {
      document.removeEventListener('mouseenter', handleEnter);
      document.removeEventListener('mouseleave', handleLeave);
    };
  }, [opacity]);

  return (
    <motion.div
      className="mouse-glow"
      style={{
        x: translateX,
        y: translateY,
        opacity,
      }}
      transition={{ opacity: { duration: 0.4 } }}
    />
  );
});
