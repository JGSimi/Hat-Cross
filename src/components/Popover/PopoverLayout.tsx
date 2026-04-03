import { motion } from 'framer-motion';
import PopoverHeader from './PopoverHeader';
import ChatWindow from '../Chat/ChatWindow';

export default function PopoverLayout() {
  return (
    <motion.div
      initial={{ scale: 0.96, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100%',
        background: `linear-gradient(135deg, var(--bg-primary) 35%, transparent)`,
        backdropFilter: 'blur(40px) saturate(1.8)',
        WebkitBackdropFilter: 'blur(40px) saturate(1.8)',
        border: '0.5px solid var(--glass-border)',
        boxShadow: 'var(--shadow-glass)',
        borderRadius: 16,
        overflow: 'hidden',
      }}
    >
      <PopoverHeader />
      <ChatWindow showScreenCapture compact />
    </motion.div>
  );
}
