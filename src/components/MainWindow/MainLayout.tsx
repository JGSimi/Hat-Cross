import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar, { type SidebarView } from './Sidebar';
import ChatWindow from '../Chat/ChatWindow';
import ClipboardHistory from '../Clipboard/ClipboardHistory';
import SettingsPanel from '../Settings/SettingsPanel';
import WindowControls from '../Shared/WindowControls';
import { usePlatform } from '../../hooks/usePlatform';
import { useChatStore } from '../../stores/chatStore';
import MouseReactiveBackground from './MouseReactiveBackground';
// AmbientBubbles removed — was intercepting clicks and breaking UI
import { useConversationStore } from '../../stores/conversationStore';
import { useSettingsStore } from '../../stores/settingsStore';

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
  const showSettings = useSettingsStore((s) => s.showSettingsPanel);
  const setShowSettings = useSettingsStore((s) => s.setShowSettingsPanel);
  const platform = usePlatform();
  const activeConversationId = useConversationStore((s) => s.activeConversationId);
  const loadFromConversation = useChatStore((s) => s.loadFromConversation);
  const [activeView, setActiveView] = useState<SidebarView>('chats');

  useEffect(() => {
    if (activeConversationId) {
      loadFromConversation(activeConversationId);
    }
  }, [activeConversationId, loadFromConversation]);

  // When user opens a chat from clipboard, switch to chats view
  useEffect(() => {
    if (activeConversationId && activeView === 'clipboard') {
      setActiveView('chats');
    }
  }, [activeConversationId]);

  return (
    <motion.div
      className="bg-atmosphere"
      variants={containerVariants}
      initial="hidden"
      animate="show"
      style={{ display: 'flex', height: '100vh', width: '100%' }}
    >
      <MouseReactiveBackground />
      <motion.div variants={itemVariants} style={{ position: 'relative', zIndex: 1 }}>
        <Sidebar
          onOpenSettings={() => setShowSettings(true)}
          activeView={activeView}
          onViewChange={setActiveView}
        />
      </motion.div>
      <motion.div variants={itemVariants} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', zIndex: 1 }}>
        {/* Titlebar drag region + window controls (Windows/Linux) */}
        <div
          data-tauri-drag-region
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 38,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            padding: platform !== 'macos' ? '0 4px' : 0,
            pointerEvents: 'auto',
          }}
        >
          {platform !== 'macos' && <WindowControls variant="header" />}
        </div>
        <AnimatePresence mode="wait">
          {showSettings ? (
            <motion.div
              key="settings"
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              style={{ position: 'absolute', inset: 0, zIndex: 60 }}
            >
              <SettingsPanel onClose={() => setShowSettings(false)} />
            </motion.div>
          ) : activeView === 'clipboard' ? (
            <motion.div
              key="clipboard"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}
            >
              <ClipboardHistory />
            </motion.div>
          ) : (
            <motion.div
              key="chat"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}
            >
              <ChatWindow showScreenCapture />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
