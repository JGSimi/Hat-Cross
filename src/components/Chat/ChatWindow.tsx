import { AnimatePresence, motion } from 'framer-motion';
import { X, AlertTriangle, Plus } from 'lucide-react';
import MessageList from './MessageList';
import InputArea from './InputArea';
import { useChat } from '../../hooks/useChat';
import { useChatStore } from '../../stores/chatStore';
import { useConversationStore } from '../../stores/conversationStore';
import EmptyState from '../Shared/EmptyState';

export default function ChatWindow() {
  const {
    messages, isStreaming, streamingContent, streamingThinking, sendMessage, cancel,
    isNearContextLimit, isAtContextLimit, contextUsage, maxContextMessages,
  } = useChat();
  const { pendingAttachments, removeAttachment, addAttachment, error } = useChatStore();
  const createConversation = useConversationStore((s) => s.createConversation);
  const activeConversationId = useConversationStore((s) => s.activeConversationId);

  const handleNewChat = () => {
    useChatStore.getState().clearMessages();
    createConversation();
  };

  const showEmpty = messages.length === 0 && !isStreaming;
  const contextPercent = Math.round(contextUsage * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Context limit banner */}
      <AnimatePresence>
        {isNearContextLimit && !showEmpty && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          >
            <div
              style={{
                padding: '8px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                background: isAtContextLimit
                  ? 'color-mix(in srgb, var(--error) 12%, transparent)'
                  : 'color-mix(in srgb, var(--warning) 10%, transparent)',
                borderBottom: `1px solid ${isAtContextLimit
                  ? 'color-mix(in srgb, var(--error) 20%, transparent)'
                  : 'color-mix(in srgb, var(--warning) 15%, transparent)'}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                <AlertTriangle
                  size={14}
                  style={{
                    color: isAtContextLimit ? 'var(--error)' : 'var(--warning)',
                    flexShrink: 0,
                  }}
                />
                <div style={{ minWidth: 0 }}>
                  <p style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: isAtContextLimit ? 'var(--error)' : 'var(--warning)',
                    margin: 0,
                  }}>
                    {isAtContextLimit
                      ? 'Limite de contexto atingido'
                      : 'Conversa longa'}
                  </p>
                  <p style={{
                    fontSize: 10,
                    color: 'var(--text-muted)',
                    margin: 0,
                    marginTop: 1,
                  }}>
                    {isAtContextLimit
                      ? `${messages.length}/${maxContextMessages} mensagens — uma nova conversa será criada na próxima mensagem`
                      : `${messages.length}/${maxContextMessages} mensagens — considere iniciar nova conversa`}
                  </p>
                </div>
                {/* Progress bar */}
                <div style={{
                  width: 60,
                  height: 4,
                  background: 'rgba(255,255,255,0.08)',
                  borderRadius: 2,
                  overflow: 'hidden',
                  flexShrink: 0,
                }}>
                  <div style={{
                    width: `${Math.min(contextPercent, 100)}%`,
                    height: '100%',
                    background: isAtContextLimit ? 'var(--error)' : 'var(--warning)',
                    borderRadius: 2,
                    transition: 'width 0.3s ease',
                  }} />
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleNewChat}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 10px',
                  borderRadius: 6,
                  fontSize: 10,
                  fontWeight: 600,
                  background: isAtContextLimit
                    ? 'var(--error)'
                    : 'color-mix(in srgb, var(--warning) 20%, transparent)',
                  color: isAtContextLimit ? 'white' : 'var(--warning)',
                  border: isAtContextLimit
                    ? 'none'
                    : '1px solid color-mix(in srgb, var(--warning) 30%, transparent)',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <Plus size={10} />
                Nova conversa
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
            <EmptyState onSuggestionClick={(text) => sendMessage(text)} />
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
              streamingThinking={streamingThinking}
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
        isStreaming={isStreaming}
        attachments={pendingAttachments}
        onRemoveAttachment={removeAttachment}
        onAddAttachment={addAttachment}
        conversationId={activeConversationId}
      />
    </div>
  );
}
