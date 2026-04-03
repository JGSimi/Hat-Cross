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

  return (
    <div className={`flex flex-col h-full ${compact ? '' : ''}`}>
      {messages.length === 0 && !isStreaming ? (
        <>
          <div className="flex-1 flex items-center justify-center">
            <EmptyState />
          </div>
          <InputArea
            onSend={sendMessage}
            onCancel={cancel}
            onScreenCapture={showScreenCapture ? handleScreenCapture : undefined}
            isStreaming={isStreaming}
            attachments={pendingAttachments}
            onRemoveAttachment={removeAttachment}
            onAddAttachment={addAttachment}
          />
        </>
      ) : (
        <>
          <MessageList
            messages={messages}
            streamingContent={streamingContent}
            isStreaming={isStreaming}
          />
          <InputArea
            onSend={sendMessage}
            onCancel={cancel}
            onScreenCapture={showScreenCapture ? handleScreenCapture : undefined}
            isStreaming={isStreaming}
            attachments={pendingAttachments}
            onRemoveAttachment={removeAttachment}
            onAddAttachment={addAttachment}
          />
        </>
      )}
    </div>
  );
}
