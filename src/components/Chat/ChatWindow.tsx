import { AnimatePresence, motion } from 'framer-motion';
import MessageList from './MessageList';
import InputArea from './InputArea';
import { useChat } from '../../hooks/useChat';
import { useChatStore } from '../../stores/chatStore';
import { useScreenCapture } from '../../hooks/useScreenCapture';
import { generateId } from '../../utils/markdown';
import EmptyState from '../Shared/EmptyState';

interface Props {
  showScreenCapture?: boolean;
}

export default function ChatWindow({ showScreenCapture = true }: Props) {
  const { messages, isStreaming, streamingContent, sendMessage, cancel } = useChat();
  const { pendingAttachments, removeAttachment, addAttachment } = useChatStore();
  const { captureScreen } = useScreenCapture();

  const handleScreenCapture = async () => {
    const base64 = await captureScreen();
    if (base64) {
      addAttachment({
        id: generateId(),
        name: 'Screenshot',
        data: base64,
        content: null,
        isImage: true,
      });
    }
  };

  const showEmpty = messages.length === 0 && !isStreaming;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <AnimatePresence mode="wait">
        {showEmpty ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <EmptyState />
          </motion.div>
        ) : (
          <motion.div
            key="messages"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          >
            <MessageList
              messages={messages}
              streamingContent={streamingContent}
              isStreaming={isStreaming}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <InputArea
        onSend={sendMessage}
        onCancel={cancel}
        onScreenCapture={showScreenCapture ? handleScreenCapture : undefined}
        isStreaming={isStreaming}
        attachments={pendingAttachments}
        onRemoveAttachment={removeAttachment}
        onAddAttachment={addAttachment}
      />
    </div>
  );
}
