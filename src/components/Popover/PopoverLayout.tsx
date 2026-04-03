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
        background: 'rgba(18, 18, 24, 0.88)',
        backdropFilter: 'blur(50px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(50px) saturate(1.6)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5), 0 0 1px rgba(255, 255, 255, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
        borderRadius: 14,
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
