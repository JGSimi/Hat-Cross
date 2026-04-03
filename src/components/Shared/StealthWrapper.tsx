import type { ReactNode } from 'react';
import { useStealth } from '../../hooks/useStealth';

interface StealthWrapperProps {
  children: ReactNode;
}

export default function StealthWrapper({ children }: StealthWrapperProps) {
  const { isHovered, stealthHoverOpacity, handlers } = useStealth();

  return (
    <div
      className={isHovered ? 'stealth-hover' : 'stealth-idle'}
      style={{ '--stealth-hover-opacity': stealthHoverOpacity } as React.CSSProperties}
      onMouseEnter={handlers.onMouseEnter}
      onMouseLeave={handlers.onMouseLeave}
    >
      {children}
    </div>
  );
}
