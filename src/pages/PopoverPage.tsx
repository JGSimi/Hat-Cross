import { useSettingsStore } from '../stores/settingsStore';
import PopoverLayout from '../components/Popover/PopoverLayout';
import StealthWrapper from '../components/Shared/StealthWrapper';

export default function PopoverPage() {
  const stealthMode = useSettingsStore((s) => s.settings.popover.stealthMode);

  if (stealthMode) {
    return (
      <StealthWrapper>
        <PopoverLayout />
      </StealthWrapper>
    );
  }

  return <PopoverLayout />;
}
