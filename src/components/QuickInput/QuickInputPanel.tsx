import { useState, useRef, useCallback, useEffect, type KeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GraduationCap, Send, Square, Copy, Check, RotateCcw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { LogicalSize } from '@tauri-apps/api/dpi';
import { useSettingsStore } from '../../stores/settingsStore';
import { PROVIDER_DEFAULTS } from '../../types';

const BASE_HEIGHT = 72;
const MAX_RESPONSE_HEIGHT = 400;

export default function QuickInputPanel() {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const responseRef = useRef('');

  // Resize window based on content
  useEffect(() => {
    const win = getCurrentWindow();
    const responseHeight = response || isStreaming ? Math.min(MAX_RESPONSE_HEIGHT, 200) : 0;
    const totalHeight = BASE_HEIGHT + responseHeight;
    win.setSize(new LogicalSize(680, totalHeight)).catch(() => {});
  }, [!!response, isStreaming]);

  const handleSend = useCallback(async () => {
    if (isStreaming) {
      invoke('cancel_stream').catch(() => {});
      setIsStreaming(false);
      return;
    }
    if (!query.trim()) return;

    setResponse('');
    responseRef.current = '';
    setIsStreaming(true);

    const { settings, providerConfigs } = useSettingsStore.getState();
    const isLocal = settings.inferenceMode === 'local';
    const provider = isLocal ? 'ollama' : settings.cloudProvider;
    const cfg = isLocal ? null : providerConfigs[settings.cloudProvider];
    const endpoint = isLocal ? 'http://localhost:11434' : cfg?.endpoint || PROVIDER_DEFAULTS[settings.cloudProvider]?.defaultEndpoint || '';
    const model = isLocal ? settings.localModel : cfg?.model || '';

    const unlisten = await listen<{ text: string; isFinished: boolean }>(
      'chat-stream',
      (event) => {
        if (event.payload.text) {
          responseRef.current += event.payload.text;
          setResponse(responseRef.current);
        }
        if (event.payload.isFinished) {
          setIsStreaming(false);
          unlisten();
        }
      },
    );

    try {
      await invoke('stream_chat', {
        messages: [{ role: 'user', textContent: query }],
        systemPrompt: settings.systemPrompt,
        provider, endpoint, model,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
        images: [],
      });
    } catch {
      setIsStreaming(false);
      setResponse('Erro ao processar. Verifique suas configurações.');
      unlisten();
    }
  }, [query, isStreaming]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') {
      if (response) {
        handleClear();
      } else {
        getCurrentWindow().hide().catch(() => {});
      }
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(response);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleClear = () => {
    setQuery('');
    setResponse('');
    responseRef.current = '';
    inputRef.current?.focus();
    getCurrentWindow().setSize(new LogicalSize(680, BASE_HEIGHT)).catch(() => {});
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      width: '100%', height: '100%',
      background: '#0e0e12', overflow: 'hidden',
    }}>
      {/* Input bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '16px 20px', flexShrink: 0,
        borderBottom: response || isStreaming ? '1px solid #1a1a22' : 'none',
      }}>
        <GraduationCap
          size={20}
          style={{ color: 'var(--color-accent)', flexShrink: 0, opacity: 0.8 }}
        />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Pergunte algo..."
          autoFocus
          disabled={isStreaming}
          style={{
            flex: 1, background: 'none', border: 'none', outline: 'none',
            color: '#e8e8ec', fontSize: 15, fontWeight: 400,
            fontFamily: 'inherit',
            opacity: isStreaming ? 0.5 : 1,
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {response && !isStreaming && (
            <motion.button
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleClear}
              title="Nova pergunta"
              style={{
                padding: 6, borderRadius: 6, background: 'none',
                border: 'none', cursor: 'pointer', display: 'flex',
                alignItems: 'center', color: '#555',
              }}
            >
              <RotateCcw size={15} />
            </motion.button>
          )}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleSend}
            style={{
              padding: 6, borderRadius: 6, background: 'none',
              border: 'none', cursor: 'pointer', display: 'flex',
              alignItems: 'center',
              color: isStreaming ? '#f87171' : query.trim() ? 'var(--color-accent)' : '#333',
            }}
          >
            {isStreaming ? <Square size={16} /> : <Send size={16} />}
          </motion.button>
        </div>
      </div>

      {/* Response area */}
      <AnimatePresence>
        {(response || (isStreaming && !response)) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              flex: 1, overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
            }}
          >
            {/* Typing indicator */}
            {isStreaming && !response && (
              <div style={{ padding: '12px 20px', display: 'flex', gap: 5 }}>
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                    style={{
                      width: 5, height: 5, borderRadius: '50%',
                      background: 'var(--color-accent)', opacity: 0.6,
                    }}
                  />
                ))}
              </div>
            )}

            {/* Markdown response */}
            {response && (
              <div style={{
                flex: 1, overflowY: 'auto', padding: '12px 20px 8px',
                maxHeight: MAX_RESPONSE_HEIGHT - 40,
              }}>
                <div className="prose prose-invert prose-sm max-w-none" style={{
                  fontSize: 13, lineHeight: 1.6, color: '#c8c8d0',
                }}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                    {response}
                  </ReactMarkdown>
                </div>
              </div>
            )}

            {/* Bottom bar: copy + hints */}
            {response && !isStreaming && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '6px 20px 10px', flexShrink: 0,
                  borderTop: '1px solid #1a1a22',
                }}
              >
                <motion.button
                  whileHover={{ color: 'var(--color-accent)' }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleCopy}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 11, color: copied ? 'var(--success)' : '#555',
                    padding: 0, transition: 'color 0.15s',
                  }}
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? 'Copiado!' : 'Copiar resposta'}
                </motion.button>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[
                    { key: 'Esc', label: 'limpar' },
                    { key: '⏎', label: 'nova pergunta' },
                  ].map((h) => (
                    <span key={h.key} style={{
                      fontSize: 9, color: '#444',
                      fontFamily: "'SF Mono', monospace",
                    }}>
                      <span style={{
                        background: '#1a1a22', padding: '1px 4px',
                        borderRadius: 3, marginRight: 3,
                        border: '1px solid #222',
                      }}>{h.key}</span>
                      {h.label}
                    </span>
                  ))}
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
