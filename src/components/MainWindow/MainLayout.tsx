import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import ChatWindow from '../Chat/ChatWindow';
import SettingsPanel from '../Settings/SettingsPanel';
import { useChatStore } from '../../stores/chatStore';
import { useConversationStore } from '../../stores/conversationStore';

export default function MainLayout() {
  const [showSettings, setShowSettings] = useState(false);
  const activeConversationId = useConversationStore((s) => s.activeConversationId);
  const loadFromConversation = useChatStore((s) => s.loadFromConversation);

  useEffect(() => {
    if (activeConversationId) {
      loadFromConversation(activeConversationId);
    }
  }, [activeConversationId, loadFromConversation]);

  return (
    <div className="flex h-screen w-full bg-[var(--color-bg-primary)]">
      <Sidebar onOpenSettings={() => setShowSettings(true)} />
      <div className="flex-1 flex flex-col">
        {showSettings ? (
          <SettingsPanel onClose={() => setShowSettings(false)} />
        ) : (
          <ChatWindow showScreenCapture />
        )}
      </div>
    </div>
  );
}
