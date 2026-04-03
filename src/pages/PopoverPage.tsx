import { useSettingsStore } from '../stores/settingsStore';
import PopoverLayout from '../components/Popover/PopoverLayout';
import StealthWrapper from '../components/Shared/StealthWrapper';

export default function PopoverPage() {
  const stealthMode = useSettingsStore((s) => s.settings.popover.stealthMode);

  const content = (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: 'transparent' }}>
      <PopoverLayout />
    </div>
  );

  if (stealthMode) {
    return <StealthWrapper>{content}</StealthWrapper>;
  }

  return content;
}
