import { useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSettingsStore } from '../stores/settingsStore';
import DisguiseClock from '../components/Popover/DisguiseClock';
import PopoverChat from '../components/Popover/PopoverChat';

export default function PopoverPage() {
  const popoverSettings = useSettingsStore((s) => s.settings.popover);
  const reducedMotion = useSettingsStore((s) => s.settings.performance.reducedMotion);
  const [revealed, setRevealed] = useState(!popoverSettings.disguiseMode);
  const [hovered, setHovered] = useState(false);

  const toggleRevealed = useCallback(() => {
    setRevealed((r) => !r);
  }, []);

  // Ghost mode class
  const ghostClass = popoverSettings.stealthMode
    ? hovered
      ? 'stealth-hover'
      : 'stealth-idle'
    : '';

  const springTransition = reducedMotion
    ? { duration: 0.01 }
    : { type: 'spring' as const, stiffness: 350, damping: 28 };

  return (
    <div
      className={`popover-ghost ${ghostClass}`}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: 'var(--bg-primary)',
        ['--stealth-hover-opacity' as string]: popoverSettings.stealthHoverOpacity,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <AnimatePresence mode="wait">
        {popoverSettings.disguiseMode && !revealed ? (
          <motion.div
            key="clock"
            initial={reducedMotion ? { opacity: 1 } : { opacity: 0, x: 0 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: -380 }}
            transition={springTransition}
            style={{ width: '100%', height: '100%' }}
          >
            <DisguiseClock onReveal={toggleRevealed} />
          </motion.div>
        ) : (
          <motion.div
            key="chat"
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, x: 380 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: 380 }}
            transition={springTransition}
            style={{ width: '100%', height: '100%' }}
          >
            <PopoverChat />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
