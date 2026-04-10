import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, MessageSquare, Send } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useSettingsStore } from '../../stores/settingsStore';
import { usePlatform } from '../../hooks/usePlatform';
import WindowControls from '../Shared/WindowControls';
import { PROVIDER_DEFAULTS } from '../../types';
import type { StreamChunk } from '../../types';
import { nextStreamId } from '../../services/ai';

function GradientSpinner() {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: 'conic-gradient(from 0deg, transparent 0%, var(--color-accent) 100%)',
        padding: 3,
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          background: 'var(--bg-primary)',
        }}
      />
    </motion.div>
  );
}

export default function AnalysisLayout() {
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [followUp, setFollowUp] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const analysisRef = useRef('');
  const platform = usePlatform();
  const settings = useSettingsStore((s) => s.settings);
  const providerConfigs = useSettingsStore((s) => s.providerConfigs);

  const getProviderDetails = () => {
    const isLocal = settings.inferenceMode === 'local';
    const provider = isLocal ? 'ollama' : settings.cloudProvider;
    const cfg = isLocal ? null : providerConfigs[settings.cloudProvider];
    const endpoint = isLocal
      ? 'http://localhost:11434'
      : cfg?.endpoint || PROVIDER_DEFAULTS[settings.cloudProvider]?.defaultEndpoint || '';
    const model = isLocal ? settings.localModel : cfg?.model || '';
    return { provider, endpoint, model };
  };

  const startAnalysis = async (imageBase64: string) => {
    setIsAnalyzing(true);
    setAnalysis('');
    analysisRef.current = '';

    const { provider, endpoint, model } = getProviderDetails();
    const streamId = nextStreamId();

    const unlisten = await listen<StreamChunk>('chat-stream', (event) => {
      const chunk = event.payload;
      if (chunk.streamId !== streamId) return;
      if (chunk.text) {
        analysisRef.current += chunk.text;
        setAnalysis(analysisRef.current);
      }
      if (chunk.isFinished) {
        setIsAnalyzing(false);
        unlisten();
      }
    });

    try {
      await invoke('stream_chat', {
        streamId,
        messages: [{
          role: 'user',
          textContent: 'Analise o que esta na minha tela e me ajude de forma proativa. Nao me pergunte o que fazer, apenas forneca a analise ou ajuda diretamente com base no contexto.',
        }],
        systemPrompt: settings.systemPrompt,
        provider,
        endpoint,
        model,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
        images: [imageBase64],
      });
    } catch {
      setAnalysis('Erro ao analisar a tela.');
      setIsAnalyzing(false);
      unlisten();
    }
  };

  const handleFollowUp = async () => {
    if (!followUp.trim() || isAnalyzing || !screenshot) return;
    const question = followUp;
    setFollowUp('');
    const prevAnalysis = analysis;

    setIsAnalyzing(true);
    setAnalysis('');
    analysisRef.current = '';

    const { provider, endpoint, model } = getProviderDetails();
    const streamId = nextStreamId();

    const unlisten = await listen<StreamChunk>('chat-stream', (event) => {
      const chunk = event.payload;
      if (chunk.streamId !== streamId) return;
      if (chunk.text) {
        analysisRef.current += chunk.text;
        setAnalysis(analysisRef.current);
      }
      if (chunk.isFinished) {
        setIsAnalyzing(false);
        unlisten();
      }
    });

    try {
      await invoke('stream_chat', {
        streamId,
        messages: [
          { role: 'user', textContent: 'Analise o que esta na minha tela.' },
          { role: 'assistant', textContent: prevAnalysis },
          { role: 'user', textContent: question },
        ],
        systemPrompt: settings.systemPrompt,
        provider,
        endpoint,
        model,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
        images: [screenshot],
      });
    } catch {
      setAnalysis('Erro ao processar follow-up.');
      setIsAnalyzing(false);
      unlisten();
    }
  };

  const handleTransferToChat = () => {
    invoke('open_main_window');
    invoke('close_window', { label: 'analysis' });
  };

  const handleNewAnalysis = async () => {
    try {
      const captured = await invoke<string>('capture_screen');
      setScreenshot(captured);
      startAnalysis(captured);
    } catch {
      setAnalysis('Falha ao capturar a tela.');
    }
  };

  useEffect(() => {
    const unlistenPromise = listen<string>('analysis-screenshot', (event) => {
      setScreenshot(event.payload);
      startAnalysis(event.payload);
    });

    const timer = setTimeout(async () => {
      if (!screenshot) {
        try {
          const captured = await invoke<string>('capture_screen');
          setScreenshot(captured);
          startAnalysis(captured);
        } catch {
          setAnalysis('Falha ao capturar a tela.');
        }
      }
    }, 500);

    return () => {
      clearTimeout(timer);
      unlistenPromise.then((fn) => fn());
    };
  }, []);

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%', background: 'var(--bg-primary)' }}>
      {/* Left panel */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          borderRight: '0.5px solid var(--border-subtle)',
        }}
      >
        <div
          data-tauri-drag-region
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '0.5px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {platform === 'macos' && <WindowControls variant="sidebar" />}
            <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              Analise de Tela
            </h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleNewAnalysis}
              title="Nova analise"
              style={{
                padding: 6,
                borderRadius: 6,
                color: 'var(--text-secondary)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <RefreshCw size={14} className={isAnalyzing ? 'animate-spin' : ''} />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleTransferToChat}
              title="Transferir para o chat"
              style={{
                padding: 6,
                borderRadius: 6,
                color: 'var(--text-secondary)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <MessageSquare size={14} />
            </motion.button>
            {platform !== 'macos' && <WindowControls variant="header" />}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          <AnimatePresence mode="wait">
            {isAnalyzing && !analysis ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                  <GradientSpinner />
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Analisando...</p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="content"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                    {analysis}
                  </ReactMarkdown>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Follow-up input styled like chat InputArea */}
        <div
          style={{
            borderTop: '0.5px solid var(--border-subtle)',
            padding: '10px 12px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--input-bg)',
              borderRadius: 10,
              border: `0.5px solid ${inputFocused ? 'var(--border-focused)' : 'var(--border-subtle)'}`,
              boxShadow: inputFocused ? '0 0 0 3px var(--accent-glow)' : 'none',
              padding: '4px 4px 4px 14px',
              transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
            }}
          >
            <input
              value={followUp}
              onChange={(e) => setFollowUp(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleFollowUp()}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              placeholder="Perguntar sobre a analise..."
              style={{
                flex: 1,
                background: 'transparent',
                color: 'var(--text-primary)',
                fontSize: 13,
                border: 'none',
              }}
            />
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleFollowUp}
              disabled={isAnalyzing}
              style={{
                padding: 8,
                borderRadius: 8,
                color: 'var(--color-accent)',
                background: 'transparent',
                border: 'none',
                cursor: isAnalyzing ? 'default' : 'pointer',
                opacity: isAnalyzing ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Send size={14} />
            </motion.button>
          </div>
        </div>
      </div>

      {/* Right panel — screenshot */}
      <div
        style={{
          width: '45%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          background: 'var(--bg-secondary)',
        }}
      >
        <AnimatePresence mode="wait">
          {screenshot ? (
            <motion.img
              key="screenshot"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              src={`data:image/png;base64,${screenshot}`}
              alt="Screenshot"
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                borderRadius: 10,
                boxShadow: 'var(--shadow-elevated)',
              }}
            />
          ) : (
            <motion.p
              key="placeholder"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ fontSize: 12, color: 'var(--text-muted)' }}
            >
              Capturando tela...
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
