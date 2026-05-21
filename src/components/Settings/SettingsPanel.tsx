import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import WindowControls from '../Shared/WindowControls';
import { usePlatform } from '../../hooks/usePlatform';
import { startWindowDrag } from '../../utils/windowDrag';
import AccountHeader from './AccountHeader';
import GeneralCard from './cards/GeneralCard';
import ClipboardCard from './cards/ClipboardCard';
import FlashCard from './cards/FlashCard';
import NotificationsCard from './cards/NotificationsCard';

interface Props {
  onClose: () => void;
}

export default function SettingsPanel({ onClose }: Props) {
  const platform = usePlatform();
  const { t } = useTranslation('settings');

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
      <div
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
          data-no-drag
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={onClose}
          aria-label={t('panel.close')}
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
          className="window-drag-region"
          data-tauri-drag-region
          onPointerDown={startWindowDrag}
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text-primary)',
            margin: 0,
            flex: 1,
          }}
        >
          {t('panel.title')}
        </h2>
        {platform !== 'macos' && <WindowControls variant="header" />}
      </div>

      <div
        className="settings-scroll"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 16,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div style={{ marginBottom: 12 }}>
          <AccountHeader />
        </div>
        <div className="settings-grid">
          <GeneralCard />
          <ClipboardCard />
          <FlashCard />
          <NotificationsCard />
        </div>
      </div>
    </motion.div>
  );
}
