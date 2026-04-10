import { useState, type KeyboardEvent } from 'react';
import { motion } from 'framer-motion';
import { Send } from 'lucide-react';

interface Props {
  onSend: (text: string) => void;
  disabled: boolean;
}

export default function FollowUpInput({ onSend, disabled }: Props) {
  const [text, setText] = useState('');
  const [isFocused, setIsFocused] = useState(false);

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
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder="Perguntar sobre a análise..."
        disabled={disabled}
        style={{
          flex: 1,
          background: 'var(--input-bg)',
          color: 'var(--text-primary)',
          borderRadius: 8,
          padding: '8px 12px',
          fontSize: 12.5,
          border: isFocused ? '0.5px solid var(--border-focused)' : '0.5px solid var(--border-subtle)',
          boxShadow: isFocused ? '0 0 0 3px var(--accent-glow)' : 'none',
          transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
          opacity: disabled ? 0.5 : 1,
        }}
      />
      <motion.button
        onClick={handleSend}
        disabled={disabled}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        style={{
          padding: 8,
          borderRadius: 8,
          background: 'transparent',
          border: 'none',
          cursor: disabled ? 'default' : 'pointer',
          color: 'var(--color-accent)',
          opacity: disabled ? 0.5 : 1,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <Send size={16} />
      </motion.button>
    </div>
  );
}
