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
        background: 'rgba(12, 12, 14, 0.82)',
        backdropFilter: 'blur(40px) saturate(1.8)',
        WebkitBackdropFilter: 'blur(40px) saturate(1.8)',
        border: '0.5px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 0.5px 0 rgba(255, 255, 255, 0.08)',
        borderRadius: 16,
        overflow: 'hidden',
      }}
    >
      <PopoverHeader />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <ChatWindow showScreenCapture compact />
      </div>
    </motion.div>
  );
}
