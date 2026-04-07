import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
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
  const { pendingAttachments, removeAttachment, addAttachment, error } = useChatStore();
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
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
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

      {error && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            padding: '8px 12px',
            margin: '0 12px 8px',
            background: 'color-mix(in srgb, var(--error) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--error) 20%, transparent)',
            borderLeft: '3px solid var(--error)',
            borderRadius: '0 8px 8px 0',
            fontSize: 12,
            color: 'var(--error)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>{error}</span>
          <button
            onClick={() => useChatStore.getState().setError(null)}
            aria-label="Fechar erro"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--error)', padding: 4, display: 'flex',
              alignItems: 'center', flexShrink: 0, marginLeft: 8,
            }}
          >
            <X size={14} />
          </button>
        </motion.div>
      )}

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
