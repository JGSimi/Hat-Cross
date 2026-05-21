import { lazy, Suspense, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clipboard, DoorOpen, Settings } from 'lucide-react';
import WindowControls from '../Shared/WindowControls';
import SettingsPanel from '../Settings/SettingsPanel';
import { usePlatform } from '../../hooks/usePlatform';
import { useSettingsStore } from '../../stores/settingsStore';
import { useClipboardStore } from '../../stores/clipboardStore';
import { useRoomSubscriptions } from '../../hooks/useRoomSubscriptions';
import { startWindowDrag } from '../../utils/windowDrag';

const ClipboardHistory = lazy(() => import('../Clipboard/ClipboardHistory'));
const RoomsPage = lazy(() => import('../../pages/RoomsPage'));

type MainView = 'rooms' | 'clipboard';

function ViewFallback({ title }: { title: string }) {
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: '22px 24px',
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)',
      }}
    >
      <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-strong)' }}>
        {title}
      </h1>
    </div>
  );
}

export default function MainLayout() {
  const showSettings = useSettingsStore((state) => state.showSettingsPanel);
  const setShowSettings = useSettingsStore((state) => state.setShowSettingsPanel);
  const clipboardCount = useClipboardStore((state) => state.entries.length);
  const platform = usePlatform();
  const [activeView, setActiveView] = useState<MainView>('rooms');

  useRoomSubscriptions(true);

  return (
    <motion.div
      className="bg-atmosphere"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ display: 'grid', gridTemplateColumns: '72px minmax(0, 1fr)', height: '100vh', width: '100%' }}
    >
      <aside
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          background: 'color-mix(in srgb, var(--bg-secondary) 88%, transparent)',
          backdropFilter: 'var(--panel-backdrop-filter-strong, blur(30px) saturate(1.5))',
          WebkitBackdropFilter: 'var(--panel-backdrop-filter-strong, blur(30px) saturate(1.5))',
          borderRight: '0.5px solid var(--border-subtle)',
          position: 'relative',
          zIndex: 4,
        }}
      >
        <div
          className="window-drag-region"
          data-tauri-drag-region
          onPointerDown={startWindowDrag}
          style={{
            width: '100%',
            minHeight: platform === 'macos' ? 58 : 46,
            display: 'grid',
            placeItems: 'center',
            borderBottom: '0.5px solid var(--border-subtle)',
          }}
        >
          {platform === 'macos' ? (
            <WindowControls variant="sidebar" />
          ) : (
            <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-bright)' }}>Hat</span>
          )}
        </div>

        <nav
          aria-label="Principal"
          style={{
            flex: 1,
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
            paddingTop: 16,
          }}
        >
          <RailButton
            label="Sala ativa"
            active={activeView === 'rooms'}
            onClick={() => setActiveView('rooms')}
          >
            <DoorOpen size={19} />
          </RailButton>
          <RailButton
            label="Clipboard"
            active={activeView === 'clipboard'}
            onClick={() => setActiveView('clipboard')}
            badge={clipboardCount > 0}
          >
            <Clipboard size={19} />
          </RailButton>
        </nav>

        <div style={{ width: '100%', padding: '0 0 14px', display: 'grid', placeItems: 'center' }}>
          <RailButton
            label="Settings"
            active={showSettings}
            onClick={() => setShowSettings(true)}
          >
            <Settings size={19} />
          </RailButton>
        </div>
      </aside>

      <main style={{ position: 'relative', minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {platform !== 'macos' && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 38,
              zIndex: 50,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 4px',
              pointerEvents: 'auto',
            }}
          >
            <div
              className="window-drag-region"
              data-tauri-drag-region
              aria-hidden
              onPointerDown={startWindowDrag}
              style={{ alignSelf: 'stretch', flex: 1, minWidth: 0 }}
            />
            <WindowControls variant="header" />
          </div>
        )}

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
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}
            >
              <Suspense fallback={<ViewFallback title="Clipboard" />}>
                <ClipboardHistory onBack={() => setActiveView('rooms')} />
              </Suspense>
            </motion.div>
          ) : (
            <motion.div
              key="rooms"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}
            >
              <Suspense fallback={<ViewFallback title="Sala ativa" />}>
                <RoomsPage />
              </Suspense>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </motion.div>
  );
}

function RailButton({
  active,
  badge,
  children,
  label,
  onClick,
}: {
  active: boolean;
  badge?: boolean;
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      style={{
        position: 'relative',
        width: 42,
        height: 42,
        borderRadius: 8,
        border: active ? '0.5px solid color-mix(in srgb, var(--color-accent) 44%, transparent)' : '0.5px solid transparent',
        background: active ? 'color-mix(in srgb, var(--color-accent) 14%, transparent)' : 'transparent',
        color: active ? 'var(--color-accent)' : 'var(--text-muted)',
        display: 'grid',
        placeItems: 'center',
        cursor: 'pointer',
      }}
    >
      {children}
      {badge && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: 'var(--color-accent)',
            border: '1px solid var(--bg-secondary)',
          }}
        />
      )}
    </button>
  );
}
