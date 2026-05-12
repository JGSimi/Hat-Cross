import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PanelLeftOpen } from 'lucide-react';
import Sidebar, { type SidebarView } from './Sidebar';
import ChatWindow from '../Chat/ChatWindow';
import ClipboardHistory from '../Clipboard/ClipboardHistory';
import RoomsPage from '../../pages/RoomsPage';
import SettingsPanel from '../Settings/SettingsPanel';
import OnboardingWizard from '../Shared/OnboardingWizard';
import ShortcutsOverlay from '../Shared/ShortcutsOverlay';
import WindowControls from '../Shared/WindowControls';
import { usePlatform } from '../../hooks/usePlatform';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useChatStore } from '../../stores/chatStore';
import { useConversationStore } from '../../stores/conversationStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useAuthStore } from '../../stores/authStore';

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

  // Onboarding: runs once per install, gated on the persistent
  // `onboardingCompleted` flag in settings. Sign-in is one of the steps inside
  // the tour, not a prerequisite for showing it — the wizard persists its own
  // completion so users who skip sign-in still only see it once.
  const hydrated = useSettingsStore((s) => s._hydrated);
  const authHydrated = useAuthStore((s) => s.isHydrated);
  const onboardingCompleted = useSettingsStore((s) => s.settings.onboardingCompleted);
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  const needsOnboarding = hydrated && authHydrated && !onboardingCompleted;

  const [activeView, setActiveView] = useState<SidebarView>('chats');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // `?` (shift + /) opens the shortcut reference overlay. The hook already
  // ignores keystrokes inside inputs/textareas unless whitelisted, so typing
  // literal `?` into chat or settings never triggers this.
  useKeyboardShortcuts({
    'shift+?': () => setShortcutsOpen(true),
  });

  useEffect(() => {
    if (activeConversationId) {
      loadFromConversation(activeConversationId);
    }
  }, [activeConversationId, loadFromConversation]);

  const handleSelectConversation = useCallback((id: string) => {
    useConversationStore.getState().setActiveConversation(id);
    if (showSettings) setShowSettings(false);
    if (activeView !== 'chats') setActiveView('chats');
  }, [showSettings, setShowSettings, activeView]);

  const handleViewChange = useCallback((view: SidebarView) => {
    setActiveView(view);
    if (view === 'clipboard') setSidebarCollapsed(true);
  }, []);

  const handleBackFromClipboard = useCallback(() => {
    setActiveView('chats');
    setSidebarCollapsed(false);
  }, []);

  // Escape key closes settings panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showSettings) {
        setShowSettings(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSettings, setShowSettings]);

  return (
    <motion.div
      className="bg-atmosphere"
      variants={containerVariants}
      initial="hidden"
      animate="show"
      style={{ display: 'flex', height: '100vh', width: '100%' }}
    >
      {/* Onboarding wizard for first-run users */}
      <AnimatePresence>
        {needsOnboarding && (
          <OnboardingWizard onComplete={() => updateSettings({ onboardingCompleted: true })} />
        )}
      </AnimatePresence>

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

      {/* Expand sidebar strip — thin left-edge hover zone */}
      <AnimatePresence>
        {sidebarCollapsed && (
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            style={{
              position: 'relative', zIndex: 2,
              display: 'flex', alignItems: 'center',
              borderRight: '0.5px solid var(--border-subtle)',
            }}
          >
            <motion.button
              whileHover={{ backgroundColor: 'var(--surface-hover)' }}
              whileTap={{ scale: 0.95 }}
              onClick={activeView === 'clipboard' ? handleBackFromClipboard : () => setSidebarCollapsed(false)}
              title={activeView === 'clipboard' ? 'Voltar aos chats' : 'Expandir sidebar'}
              style={{
                width: 28, height: '100%',
                background: 'color-mix(in srgb, var(--bg-secondary) 60%, transparent)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: 'none',
                cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                color: activeView === 'clipboard' ? 'var(--color-accent)' : 'var(--text-muted)',
                transition: 'color 0.15s ease',
              }}
            >
              {activeView === 'clipboard' ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              ) : (
                <PanelLeftOpen size={14} />
              )}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content area */}
      <motion.div variants={itemVariants} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', zIndex: 1 }}>
        {/* Titlebar drag region + window controls */}
        <div
          data-tauri-drag-region
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 38,
            zIndex: 50, display: 'flex', alignItems: 'center',
            justifyContent: 'flex-end',
            padding: '0 4px',
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
              <ClipboardHistory onBack={handleBackFromClipboard} />
            </motion.div>
          ) : activeView === 'rooms' ? (
            <motion.div
              key="rooms"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}
            >
              <RoomsPage />
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
              <ChatWindow />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <ShortcutsOverlay
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
    </motion.div>
  );
}
