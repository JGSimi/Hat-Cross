import { User } from 'lucide-react';
import SettingsCard from './SettingsCard';
import AccountTab from '../../Account/AccountTab';
import { useAuthStore } from '../../../stores/authStore';
import { useCreditsStore } from '../../../stores/creditsStore';
import { AI_MODES } from '../../../types/account';

export default function AccountCard() {
  const user = useAuthStore((s) => s.user);
  const credits = useCreditsStore((s) => s.credits);
  const creditsLoading = useCreditsStore((s) => s.isLoading);
  const selectedMode = useCreditsStore((s) => s.selectedMode);

  const preview = !user
    ? 'Não conectado'
    : (() => {
        const modeLabel = AI_MODES.find((m) => m.id === selectedMode)?.label ?? 'Hat';
        if (creditsLoading) return `${modeLabel} · ...`;
        return `${modeLabel} · ${credits.toLocaleString('pt-BR')} créd`;
      })();

  return (
    <SettingsCard
      title="Conta"
      icon={<User size={14} strokeWidth={2} />}
      preview={preview}
      defaultOpen={!user}
    >
      <AccountTab />
    </SettingsCard>
  );
}
