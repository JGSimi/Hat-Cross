import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ImageIcon } from 'lucide-react';

interface Props {
  base64: string;
  size?: number;
  alt?: string;
  rounded?: number;
  onClick?: (e: React.MouseEvent) => void;
}

export default function ClipboardImageThumb({
  base64,
  size = 24,
  alt = 'clipboard image',
  rounded = 5,
  onClick,
}: Props) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  return (
    <motion.div
      ref={ref}
      whileHover={reduceMotion ? undefined : { scale: 1.05 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      onClick={onClick}
      style={{
        width: size,
        height: size,
        borderRadius: rounded,
        overflow: 'hidden',
        background: 'color-mix(in srgb, var(--text-primary) 6%, transparent)',
        border: '0.5px solid rgba(255,255,255,0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {visible ? (
        <img
          src={`data:image/png;base64,${base64}`}
          alt={alt}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      ) : (
        <ImageIcon size={Math.min(12, size * 0.5)} style={{ color: 'var(--text-dim)', opacity: 0.6 }} />
      )}
    </motion.div>
  );
}
