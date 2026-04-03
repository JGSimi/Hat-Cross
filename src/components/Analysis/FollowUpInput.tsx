import { useState, type KeyboardEvent } from 'react';
import { Send } from 'lucide-react';

interface Props {
  onSend: (text: string) => void;
  disabled: boolean;
}

export default function FollowUpInput({ onSend, disabled }: Props) {
  const [text, setText] = useState('');

  const handleSend = () => {
    if (!text.trim() || disabled) return;
    onSend(text);
    setText('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Perguntar sobre a análise..."
        disabled={disabled}
        className="flex-1 bg-[var(--color-bg-input)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] rounded-lg px-3 py-2 text-sm outline-none border border-[var(--color-border)] focus:border-[var(--color-border-focus)] transition-colors disabled:opacity-50"
      />
      <button
        onClick={handleSend}
        disabled={disabled}
        className="p-2 rounded-lg text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 transition-colors disabled:opacity-50"
      >
        <Send size={16} />
      </button>
    </div>
  );
}
