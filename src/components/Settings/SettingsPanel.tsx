import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import WindowControls from '../Shared/WindowControls';
import { usePlatform } from '../../hooks/usePlatform';
import AccountHeader from './AccountHeader';
import GeneralCard from './cards/GeneralCard';
import AppearanceCard from './cards/AppearanceCard';
import AICard from './cards/AICard';
import ClipboardCard from './cards/ClipboardCard';
import FlashCard from './cards/FlashCard';
import PopoverCard from './cards/PopoverCard';
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

      {/* Cards grid — container-query driven breakpoints */}
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
            // Frosted: deixa o gradient atmosférico do bg vazar através do
            // sticky em vez de um bloco sólido que parece preto em todos os
            // temas escuros. Combina tinta do tema via surface-primary.
            background:
              'color-mix(in srgb, var(--surface-primary) 72%, transparent)',
            backdropFilter: 'blur(14px) saturate(1.3)',
            WebkitBackdropFilter: 'blur(14px) saturate(1.3)',
            borderBottom: '0.5px solid var(--border-subtle)',
          }}
        >
          <AccountHeader />
        </div>
        <motion.div layout className="settings-grid">
          <GeneralCard />
          <AppearanceCard />
          <AICard />
          <ClipboardCard />
          <FlashCard />
          <PopoverCard />
          <NotificationsCard />
        </motion.div>
      </div>
    </motion.div>
  );
}
