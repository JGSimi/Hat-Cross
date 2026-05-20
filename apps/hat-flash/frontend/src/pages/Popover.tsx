import { type KeyboardEvent, useState } from 'react';
import { Bot, Copy, Loader2, MonitorUp, Send, Sparkles, Square, X, Zap } from 'lucide-react';
import { hat } from '../bridge/hat';
import { useHatStore } from '../stores/hatStore';

export function Popover() {
  const settings = useHatStore((s) => s.settings);
  const response = useHatStore((s) => s.response);
  const streamID = useHatStore((s) => s.streamID);
  const resetStream = useHatStore((s) => s.resetStream);
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function send() {
    if (!settings || !prompt.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const next = resetStream();
      await hat.chat.stream({
        streamId: next,
        messages: [{ role: 'user', textContent: prompt.trim() }],
        systemPrompt: settings.systemPrompt,
        mode: settings.mode,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
        roomShare: false,
        idempotencyKey: crypto.randomUUID(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao enviar.');
    } finally {
      setBusy(false);
    }
  }

  async function flash() {
    if (!settings || !response) return;
    await hat.flash.show({
      text: response.slice(0, settings.clipboard.flash.previewLength),
      position: settings.clipboard.flash.position,
      timing: settings.clipboard.flash.timing,
      appearance: settings.clipboard.flash.appearance,
      streamId: streamID,
    });
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      void send();
    }
  }

  return (
    <main className="popover">
      <header className="popover-header">
        <div className="popover-title">
          <Sparkles size={17} />
          <div>
            <h1>Hat</h1>
          </div>
        </div>
        <div className="popover-chrome">
          <span className={`popover-pill ${settings?.mode === 'hat-pro' ? 'pro' : ''}`}>
            {settings?.mode === 'hat-pro' ? <Sparkles size={13} /> : <Zap size={13} />}
            {settings?.mode === 'hat-pro' ? 'Hat Pro' : 'Hat'}
          </span>
          <button className="icon-button" onClick={() => hat.popover.toggle()} aria-label="Fechar popover">
            <X size={16} />
          </button>
        </div>
      </header>

      <section className="popover-body">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Pergunta..."
          autoFocus
        />
        <div className="popover-result">
          {error ? (
            <span className="danger-copy">{error}</span>
          ) : response ? (
            <pre>{response}</pre>
          ) : (
            <div className="popover-empty">
              <Bot size={24} />
              <strong>Vazio</strong>
            </div>
          )}
        </div>
      </section>

      <footer className="popover-actions">
        <button onClick={() => hat.clipboard.writeText(response)} disabled={!response || busy}>
          <Copy size={16} />
          Copiar
        </button>
        <button onClick={flash} disabled={!response || busy}>
          <MonitorUp size={16} />
          Flash
        </button>
        <button onClick={() => hat.chat.cancel(streamID)} disabled={!busy} aria-label="Parar">
          <Square size={16} />
        </button>
        <button className="primary-button" onClick={send} disabled={!settings || !prompt.trim() || busy}>
          {busy ? <Loader2 className="spin" size={16} /> : <Send size={16} />}
          Enviar
        </button>
      </footer>
    </main>
  );
}
