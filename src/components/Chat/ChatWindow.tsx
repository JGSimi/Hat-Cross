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
  compact?: boolean;
}

export default function ChatWindow({ showScreenCapture = true, compact = false }: Props) {
  const { messages, isStreaming, streamingContent, sendMessage, cancel } = useChat();
  const { pendingAttachments, removeAttachment, addAttachment } = useChatStore();
  const { captureForPopover } = useScreenCapture();

  const handleScreenCapture = async () => {
    const base64 = await captureForPopover();
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
    <div className={`flex flex-col h-full ${compact ? '' : ''}`}>
      <AnimatePresence mode="wait">
        {showEmpty ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex items-center justify-center"
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
            className="flex-1 flex flex-col overflow-hidden"
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
