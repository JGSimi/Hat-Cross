import { useState, useEffect, useRef } from 'react';
import { RefreshCw, MessageSquare, Send } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useSettingsStore } from '../../stores/settingsStore';
import { PROVIDER_DEFAULTS } from '../../types';
import type { StreamChunk } from '../../types';

export default function AnalysisLayout() {
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [followUp, setFollowUp] = useState('');
  const analysisRef = useRef('');
  const settings = useSettingsStore((s) => s.settings);
  const providerConfigs = useSettingsStore((s) => s.providerConfigs);

  const getProviderDetails = () => {
    const isLocal = settings.inferenceMode === 'local';
    const provider = isLocal ? 'ollama' : settings.cloudProvider;
    const cfg = isLocal ? null : providerConfigs[settings.cloudProvider];
    const endpoint = isLocal
      ? 'http://localhost:11434'
      : cfg?.endpoint || PROVIDER_DEFAULTS[settings.cloudProvider]?.defaultEndpoint || '';
    const apiKey = isLocal ? '' : cfg?.apiKey || '';
    const model = isLocal ? settings.localModel : cfg?.model || '';
    return { provider, endpoint, apiKey, model };
  };

  const startAnalysis = async (imageBase64: string) => {
    setIsAnalyzing(true);
    setAnalysis('');
    analysisRef.current = '';

    const { provider, endpoint, apiKey, model } = getProviderDetails();

    const unlisten = await listen<StreamChunk>('chat-stream', (event) => {
      const chunk = event.payload;
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
        messages: [{
          role: 'user',
          textContent: 'Analise o que está na minha tela e me ajude de forma proativa. Não me pergunte o que fazer, apenas forneça a análise ou ajuda diretamente com base no contexto.',
        }],
        systemPrompt: settings.systemPrompt,
        provider,
        endpoint,
        apiKey,
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

    const { provider, endpoint, apiKey, model } = getProviderDetails();

    const unlisten = await listen<StreamChunk>('chat-stream', (event) => {
      const chunk = event.payload;
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
        messages: [
          { role: 'user', textContent: 'Analise o que está na minha tela.' },
          { role: 'assistant', textContent: prevAnalysis },
          { role: 'user', textContent: question },
        ],
        systemPrompt: settings.systemPrompt,
        provider,
        endpoint,
        apiKey,
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
    // Listen for screenshot passed from shortcut
    const unlistenPromise = listen<string>('analysis-screenshot', (event) => {
      setScreenshot(event.payload);
      startAnalysis(event.payload);
    });

    // Also auto-capture on mount if no screenshot event comes
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
    <div className="flex h-screen w-full bg-[var(--color-bg-primary)]">
      {/* Left panel */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-[var(--color-border)]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Análise de Tela</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={handleNewAnalysis}
              className="p-1.5 rounded-md text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-colors"
              title="Nova análise"
            >
              <RefreshCw size={14} className={isAnalyzing ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={handleTransferToChat}
              className="p-1.5 rounded-md text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-colors"
              title="Transferir para o chat"
            >
              <MessageSquare size={14} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {isAnalyzing && !analysis ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-[var(--color-text-secondary)]">Analisando...</p>
              </div>
            </div>
          ) : (
            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                {analysis}
              </ReactMarkdown>
            </div>
          )}
        </div>

        <div className="border-t border-[var(--color-border)] px-3 py-2.5">
          <div className="flex items-center gap-2">
            <input
              value={followUp}
              onChange={(e) => setFollowUp(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleFollowUp()}
              placeholder="Perguntar sobre a análise..."
              className="flex-1 bg-[var(--color-bg-input)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] rounded-lg px-3 py-2 text-sm outline-none border border-[var(--color-border)] focus:border-[var(--color-border-focus)] transition-colors"
            />
            <button
              onClick={handleFollowUp}
              disabled={isAnalyzing}
              className="p-2 rounded-lg text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 transition-colors disabled:opacity-50"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="w-[45%] flex items-center justify-center p-4 bg-[var(--color-bg-secondary)]">
        {screenshot ? (
          <img
            src={`data:image/png;base64,${screenshot}`}
            alt="Screenshot"
            className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
          />
        ) : (
          <p className="text-sm text-[var(--color-text-muted)]">Capturando tela...</p>
        )}
      </div>
    </div>
  );
}
