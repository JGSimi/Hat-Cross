import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar, { type SidebarView } from './Sidebar';
import ChatWindow from '../Chat/ChatWindow';
import ClipboardHistory from '../Clipboard/ClipboardHistory';
import SettingsPanel from '../Settings/SettingsPanel';
import WindowControls from '../Shared/WindowControls';
import { usePlatform } from '../../hooks/usePlatform';
import { useChatStore } from '../../stores/chatStore';
import MouseReactiveBackground from './MouseReactiveBackground';
import { useConversationStore } from '../../stores/conversationStore';
import { useSettingsStore } from '../../stores/settingsStore';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Load conversation messages when active conversation changes
  useEffect(() => {
    if (activeConversationId) {
      loadFromConversation(activeConversationId);
    }
  }, [activeConversationId, loadFromConversation]);

  // Selecting a conversation closes settings and returns to chats
  const handleSelectConversation = useCallback((id: string) => {
    useConversationStore.getState().setActiveConversation(id);
    if (showSettings) setShowSettings(false);
    if (activeView !== 'chats') setActiveView('chats');
  }, [showSettings, setShowSettings, activeView]);

  // Switching to clipboard auto-collapses sidebar
  const handleViewChange = useCallback((view: SidebarView) => {
    setActiveView(view);
    if (view === 'clipboard') {
      setSidebarCollapsed(true);
    }
  }, []);

  // Back from clipboard: restore sidebar and switch to chats
  const handleBackFromClipboard = useCallback(() => {
    setActiveView('chats');
    setSidebarCollapsed(false);
  }, []);

  return (
    <motion.div
      className="bg-atmosphere"
      variants={containerVariants}
      initial="hidden"
      animate="show"
      style={{ display: 'flex', height: '100vh', width: '100%' }}
    >
      <MouseReactiveBackground />

      {/* Sidebar with animated width */}
      <motion.div
        variants={itemVariants}
        animate={{ width: sidebarCollapsed ? 0 : 'auto', opacity: sidebarCollapsed ? 0 : 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        style={{ position: 'relative', zIndex: 1, overflow: 'hidden', flexShrink: 0 }}
      >
        <Sidebar
          onOpenSettings={() => setShowSettings(true)}
          activeView={activeView}
          onViewChange={handleViewChange}
          onSelectConversation={handleSelectConversation}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </motion.div>

      {/* Main content area */}
      <motion.div variants={itemVariants} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', zIndex: 1 }}>
        {/* Titlebar drag region + window controls */}
        <div
          data-tauri-drag-region
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 38,
            zIndex: 50, display: 'flex', alignItems: 'center',
            justifyContent: sidebarCollapsed ? 'space-between' : 'flex-end',
            padding: '0 4px',
            pointerEvents: 'auto',
          }}
        >
          {/* Show expand button when sidebar is collapsed */}
          {sidebarCollapsed && (
            <motion.button
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={activeView === 'clipboard' ? handleBackFromClipboard : () => setSidebarCollapsed(false)}
              data-no-drag
              style={{
                padding: '4px 8px', borderRadius: 6,
                background: 'var(--glass-secondary)',
                border: '0.5px solid var(--glass-border-subtle)',
                color: 'var(--text-secondary)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 10, fontWeight: 500,
                marginLeft: platform === 'macos' ? 72 : 4,
              }}
            >
              {activeView === 'clipboard' ? (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                  Voltar
                </>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
              )}
            </motion.button>
          )}
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
              <ClipboardHistory onBack={handleBackFromClipboard} />
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
