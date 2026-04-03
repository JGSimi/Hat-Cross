import PopoverHeader from './PopoverHeader';
import ChatWindow from '../Chat/ChatWindow';

export default function PopoverLayout() {
  return (
    <div className="flex flex-col h-screen w-full glass rounded-2xl overflow-hidden border border-[var(--color-border)]">
      <PopoverHeader />
      <ChatWindow showScreenCapture compact />
    </div>
  );
}
