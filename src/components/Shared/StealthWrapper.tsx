import { type ReactNode, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useStealth } from '../../hooks/useStealth';

interface Props {
  children: ReactNode;
}

export default function StealthWrapper({ children }: Props) {
  const { isHovered, stealthHoverOpacity, handlers } = useStealth();

  // When idle (not hovered), make the window click-through
  useEffect(() => {
    const win = getCurrentWindow();
    win.setIgnoreCursorEvents(!isHovered).catch(() => {});
  }, [isHovered]);

  return (
    <motion.div
      animate={{
        opacity: isHovered ? stealthHoverOpacity : 0.08,
        filter: isHovered ? 'saturate(0.3)' : 'saturate(0)',
      }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      onMouseEnter={handlers.onMouseEnter}
      onMouseLeave={handlers.onMouseLeave}
      style={{ width: '100%', height: '100%' }}
    >
      {children}
    </motion.div>
  );
}
