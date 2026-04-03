import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import type { Message } from '../../types';

interface Props {
  message: Message;
  isGrouped: boolean;
}

export default function MessageBubble({ message, isGrouped }: Props) {
  return (
    <div
      className={`flex ${message.isUser ? 'justify-end' : 'justify-start'} ${
        isGrouped ? 'mt-1' : 'mt-3'
      } animate-fade-in`}
    >
      <div
        className={`max-w-[85%] px-3.5 py-2.5 rounded-xl text-sm leading-relaxed ${
          message.isUser
            ? 'bg-[var(--color-user-bubble)] text-[var(--color-text-primary)] rounded-br-md'
            : 'bg-[var(--color-ai-bubble)] text-[var(--color-text-primary)] rounded-bl-md'
        }`}
      >
        {message.isUser ? (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        ) : (
          <div className="prose prose-invert prose-sm max-w-none break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
