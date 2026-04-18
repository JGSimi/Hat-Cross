import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import WindowControls from '../Shared/WindowControls';
import { usePlatform } from '../../hooks/usePlatform';
import AccountHeader from './AccountHeader';
import AppearanceCard from './cards/AppearanceCard';
import AICard from './cards/AICard';
import ClipboardCard from './cards/ClipboardCard';
import FlashCard from './cards/FlashCard';
import PopoverCard from './cards/PopoverCard';
import ShortcutsCard from './cards/ShortcutsCard';
import NotificationsCard from './cards/NotificationsCard';

interface Props {
  onClose: () => void;
}

export default function SettingsPanel({ onClose }: Props) {
  const platform = usePlatform();

  return (
    <motion.div
      initial={{ x: 40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--bg-primary)',
      }}
      className="bg-atmosphere"
    >
      {/* Header — drag region for custom titlebar */}
      <div
        data-tauri-drag-region
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          borderBottom: '0.5px solid var(--border-subtle)',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={onClose}
          aria-label="Voltar"
          style={{
            padding: 6,
            borderRadius: 6,
            color: 'var(--text-secondary)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <ArrowLeft size={16} />
        </motion.button>
        <h2
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text-primary)',
            margin: 0,
            flex: 1,
          }}
        >
          Configurações
        </h2>
        {platform !== 'macos' && <WindowControls variant="header" />}
      </div>

      {/* Cards grid */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 16,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div
          style={{
            position: 'sticky',
            top: -16,
            zIndex: 5,
            marginTop: -16,
            marginLeft: -16,
            marginRight: -16,
            marginBottom: 12,
            paddingTop: 16,
            paddingLeft: 16,
            paddingRight: 16,
            paddingBottom: 12,
            background: 'var(--bg-primary)',
            borderBottom: '0.5px solid var(--border-subtle)',
          }}
        >
          <AccountHeader />
        </div>
        <motion.div
          layout
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 12,
            alignItems: 'start',
          }}
        >
          <AppearanceCard />
          <AICard />
          <ClipboardCard />
          <FlashCard />
          <PopoverCard />
          <ShortcutsCard />
          <NotificationsCard />
        </motion.div>
      </div>
    </motion.div>
  );
}
