import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useStealth } from '../../hooks/useStealth';

interface Props {
  children: ReactNode;
}

export default function StealthWrapper({ children }: Props) {
  const { isHovered, stealthHoverOpacity, handlers } = useStealth();

  return (
    <motion.div
      animate={{
        opacity: isHovered ? stealthHoverOpacity : 0.02,
        filter: isHovered ? 'saturate(0.3)' : 'saturate(0)',
      }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      onMouseEnter={handlers.onMouseEnter}
      onMouseLeave={handlers.onMouseLeave}
    >
      {children}
    </motion.div>
  );
}
