import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './Sidebar';
import ChatWindow from '../Chat/ChatWindow';
import SettingsPanel from '../Settings/SettingsPanel';
import { useChatStore } from '../../stores/chatStore';
import { useConversationStore } from '../../stores/conversationStore';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 280, damping: 24 },
  },
};

export default function MainLayout() {
  const [showSettings, setShowSettings] = useState(false);
  const activeConversationId = useConversationStore((s) => s.activeConversationId);
  const loadFromConversation = useChatStore((s) => s.loadFromConversation);

  useEffect(() => {
    if (activeConversationId) {
      loadFromConversation(activeConversationId);
    }
  }, [activeConversationId, loadFromConversation]);

  return (
    <motion.div
      className="bg-atmosphere"
      variants={containerVariants}
      initial="hidden"
      animate="show"
      style={{ display: 'flex', height: '100vh', width: '100%' }}
    >
      <motion.div variants={itemVariants} style={{ position: 'relative', zIndex: 1 }}>
        <Sidebar onOpenSettings={() => setShowSettings(true)} />
      </motion.div>
      <motion.div variants={itemVariants} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', zIndex: 1 }}>
        <AnimatePresence mode="wait">
          {showSettings ? (
            <motion.div
              key="settings"
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              style={{ position: 'absolute', inset: 0, zIndex: 10 }}
            >
              <SettingsPanel onClose={() => setShowSettings(false)} />
            </motion.div>
          ) : (
            <motion.div
              key="chat"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
            >
              <ChatWindow showScreenCapture />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
