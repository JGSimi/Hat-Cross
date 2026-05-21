import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Events } from '@wailsio/runtime';
import type { LucideIcon } from 'lucide-react';
import {
  AlertCircle,
  Check,
  Clipboard,
  Copy,
  DoorOpen,
  Hash,
  KeyRound,
  Keyboard,
  Loader2,
  LogOut,
  MonitorUp,
  MoreHorizontal,
  Power,
  RadioTower,
  RefreshCw,
  RotateCcw,
  Settings,
  ShieldAlert,
  Send,
  Sparkles,
  Square,
  Trash2,
  Wand2,
  X,
  Zap,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import { firebaseAuth, firebaseReady, signInWithGoogle, signOutGoogle, watchAuth, watchCredits } from '../services/firebase';
import { createRoom, joinRoom, leaveRoom } from '../services/rooms';
import { hat, type ChatStreamRequest, type Settings as HatSettings } from '../bridge/hat';
import { useHatStore } from '../stores/hatStore';

type Status = 'idle' | 'busy' | 'error';
type DrawerView = 'rooms' | 'clipboard' | 'system';
type ShortcutKey = keyof HatSettings['shortcuts'];

const shortcutLabels: Record<ShortcutKey, { label: string; hint: string }> = {
  processClipboardFlash: { label: 'Clipboard + Flash', hint: 'Processa e mostra overlay' },
  adjustFlashPosition: { label: 'Flash', hint: 'Ajusta posicao do overlay' },
  emergencyQuit: { label: 'Sair', hint: 'Fecha o app imediatamente' },
};

const defaultShortcuts: Record<ShortcutKey, string> = {
  processClipboardFlash: 'CommandOrControl+Shift+F',
  adjustFlashPosition: 'CommandOrControl+Alt+F',
  emergencyQuit: 'CommandOrControl+Shift+Q',
};

function friendlyError(err: unknown) {
  const raw = err instanceof Error ? err.message : String(err);
  const text = raw.toLowerCase();
  if (text === 'auth' || text.includes('auth') || text.includes('firebase')) return 'Conecte sua conta Google para continuar.';
  if (text.includes('clipboard')) return 'Clipboard vazio ou bloqueado pelo Windows.';
  if (text.includes('network') || text.includes('fetch')) return 'Sem conexao com o Hat. Tente novamente.';
  return raw || 'Algo falhou. Tente novamente.';
}

function shortEmail(email?: string | null) {
  if (!email) return 'Desconectado';
  const [name, domain] = email.split('@');
  return `${name}@${domain?.split('.')[0] ?? ''}`;
}

function shortcutParts(shortcut: string) {
  return shortcut.split('+').map((part) => part.trim()).filter(Boolean);
}

function shortcutTokenLabel(token: string) {
  const normalized = token.toLowerCase();
  if (normalized === 'commandorcontrol') return 'Ctrl/Cmd';
  if (normalized === 'control') return 'Ctrl';
  if (normalized === 'command') return 'Cmd';
  if (normalized === 'option') return 'Alt';
  if (normalized === 'escape') return 'Esc';
  return token.length === 1 ? token.toUpperCase() : token;
}

function normalizeShortcutKey(key: string) {
  if (key.length === 1) {
    if (key === ' ') return 'Space';
    if (/^[a-z0-9]$/i.test(key)) return key.toUpperCase();
    return null;
  }

  const lower = key.toLowerCase();
  if (lower === 'control' || lower === 'shift' || lower === 'alt' || lower === 'meta') return null;
  if (lower === ' ') return 'Space';
  if (/^f([1-9]|1[0-9]|2[0-4])$/i.test(key)) return key.toUpperCase();
  return null;
}

function shortcutFromEvent(event: ReactKeyboardEvent) {
  if (event.key === 'Escape') return { cancelled: true };
  if (event.key === 'Backspace' || event.key === 'Delete') return { value: '' };

  const key = normalizeShortcutKey(event.key);
  if (!key) return { error: 'Tecla nao suportada.' };

  const modifiers: string[] = [];
  if (event.metaKey || event.ctrlKey) modifiers.push('CommandOrControl');
  if (event.altKey) modifiers.push('Alt');
  if (event.shiftKey) modifiers.push('Shift');
  if (modifiers.length === 0) return { error: 'Use Ctrl, Cmd, Alt ou Shift.' };

  return { value: [...modifiers, key].join('+') };
}

export function Main() {
  const settings = useHatStore((s) => s.settings);
  const response = useHatStore((s) => s.response);
  const thinking = useHatStore((s) => s.thinking);
  const streamID = useHatStore((s) => s.streamID);
  const clipboardText = useHatStore((s) => s.clipboardText);
  const clipboardImage = useHatStore((s) => s.clipboardImage);
  const setClipboard = useHatStore((s) => s.setClipboard);
  const resetStream = useHatStore((s) => s.resetStream);
  const saveSettings = useHatStore((s) => s.saveSettings);
  const loadSettings = useHatStore((s) => s.loadSettings);

  const [drawer, setDrawer] = useState<DrawerView>('rooms');
  const [user, setUser] = useState<User | null>(firebaseAuth?.currentUser ?? null);
  const [credits, setCredits] = useState<number | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [activeAction, setActiveAction] = useState('');
  const [error, setError] = useState('');
  const [prompt, setPrompt] = useState('');
  const [roomID, setRoomID] = useState('');
  const [roomTitle, setRoomTitle] = useState('Sala Hat');
  const roomShare = Boolean(roomID.trim());
  const [updateMessage, setUpdateMessage] = useState('');
  const [quitConfirm, setQuitConfirm] = useState(false);
  const responseRef = useRef('');

  useEffect(() => {
    const stopAuth = watchAuth((nextUser) => setUser(nextUser));
    return stopAuth;
  }, []);

  useEffect(() => {
    if (!user) {
      setCredits(null);
      return;
    }
    return watchCredits(user.uid, (doc) => setCredits(doc.credits ?? 0));
  }, [user]);

  useEffect(() => {
    if (!quitConfirm) return;
    const timer = window.setTimeout(() => setQuitConfirm(false), 3000);
    return () => window.clearTimeout(timer);
  }, [quitConfirm]);

  const isBusy = status === 'busy';
  const canUseBackend = Boolean(user && settings);
  const activeText = (prompt || clipboardText).trim();
  const hasInput = Boolean(activeText || clipboardImage);
  const mode = settings?.mode ?? 'hat';
  const inputSummary = clipboardImage ? 'Imagem anexada' : activeText ? `${activeText.length} caracteres` : 'Sem entrada';

  const streamRequest = useMemo(() => {
    if (!settings) return null;
    return {
      streamId: streamID,
      messages: [{ role: 'user', textContent: activeText || 'Analise o clipboard.' }],
      systemPrompt: settings.systemPrompt,
      mode: mode as ChatStreamRequest['mode'],
      temperature: settings.temperature,
      maxTokens: settings.maxTokens,
      images: clipboardImage ? [clipboardImage] : [],
      roomId: roomID || null,
      roomShare: Boolean(roomID),
      sourceMessageId: crypto.randomUUID(),
      idempotencyKey: crypto.randomUUID(),
    } satisfies ChatStreamRequest;
  }, [activeText, clipboardImage, mode, roomID, roomShare, settings, streamID]);

  useEffect(() => {
    responseRef.current = response;
  }, [response]);

  useEffect(() => {
    const offDone = Events.On('stream:done', (event) => {
      const doneStreamId = Number(event.data?.streamId ?? 0);
      if (doneStreamId !== streamID || !settings) return;
      const finalResponse = responseRef.current;
      if (!finalResponse) return;
      if (settings.clipboard.copyResponseToClipboard) {
        void hat.clipboard.writeText(finalResponse);
      }
      if (settings.clipboard.flash.enabled) {
        void hat.flash.show({
          text: finalResponse.slice(0, settings.clipboard.flash.previewLength),
          position: settings.clipboard.flash.position,
          timing: settings.clipboard.flash.timing,
          appearance: settings.clipboard.flash.appearance,
          streamId: streamID,
        });
      }
    });
    const offShortcut = Events.On('shortcut:pressed', (event) => {
      if (event.data?.action === 'processClipboardFlash') {
        void runGuarded('Processando clipboard...', processClipboardAndSend);
      }
    });
    return () => {
      offDone();
      offShortcut();
    };
  }, [settings, streamID]);

  async function runGuarded(actionLabel: string, action: () => Promise<void>) {
    setStatus('busy');
    setActiveAction(actionLabel);
    setError('');
    try {
      await action();
      setStatus('idle');
    } catch (err) {
      setStatus('error');
      setError(friendlyError(err));
    } finally {
      setActiveAction('');
    }
  }

  async function sendChat() {
    if (!streamRequest || !canUseBackend || !hasInput) return;
    const nextStream = resetStream();
    await hat.chat.stream({ ...streamRequest, streamId: nextStream });
  }

  async function processClipboard() {
    const payload = await hat.clipboard.process();
    setClipboard(payload.text, payload.image?.dataUrl ?? null);
    setPrompt(payload.text || 'Analise a imagem do clipboard.');
    setDrawer('clipboard');
  }

  async function processClipboardAndSend() {
    if (!settings || !canUseBackend) return;
    const payload = await hat.clipboard.process();
    const text = payload.text || 'Analise a imagem do clipboard.';
    const image = payload.image?.dataUrl ?? null;
    setClipboard(payload.text, image);
    setPrompt(text);
    setDrawer('clipboard');
    const nextStream = resetStream();
    await hat.chat.stream({
      streamId: nextStream,
      messages: [{ role: 'user', textContent: text }],
      systemPrompt: settings.systemPrompt,
      mode: mode as ChatStreamRequest['mode'],
      temperature: settings.temperature,
      maxTokens: settings.maxTokens,
      images: image ? [image] : [],
      roomId: roomID || null,
      roomShare: Boolean(roomID),
      sourceMessageId: roomID ? crypto.randomUUID() : null,
      idempotencyKey: crypto.randomUUID(),
    });
  }

  async function copyResponse() {
    if (response) await hat.clipboard.writeText(response);
  }

  async function copyInput() {
    if (activeText) await hat.clipboard.writeText(activeText);
  }

  async function copyRoomID() {
    if (roomID) await hat.clipboard.writeText(roomID);
  }

  async function flashResponse() {
    if (!settings || !response) return;
    await hat.flash.show({
      text: response.slice(0, settings.clipboard.flash.previewLength),
      position: settings.clipboard.flash.position,
      timing: settings.clipboard.flash.timing,
      appearance: settings.clipboard.flash.appearance,
      streamId: streamID,
    });
  }

  async function createRoomFromTitle() {
    const token = await firebaseAuth?.currentUser?.getIdToken();
    if (!token) throw new Error('auth');
    const result = await createRoom(roomTitle.trim() || 'Sala Hat', token);
    setRoomID(result.roomId);
  }

  async function joinCurrentRoom() {
    const token = await firebaseAuth?.currentUser?.getIdToken();
    if (!token) throw new Error('auth');
    const result = await joinRoom(roomID.trim(), token);
    setRoomID(result.roomId);
  }

  async function leaveCurrentRoom() {
    const token = await firebaseAuth?.currentUser?.getIdToken();
    if (!token || !roomID) throw new Error('auth');
    await leaveRoom(roomID, token);
    setRoomID('');
  }

  async function saveShortcut(key: ShortcutKey, value: string) {
    if (!settings) return;
    await saveSettings({
      ...settings,
      shortcuts: { ...settings.shortcuts, [key]: value },
    });
  }

  async function setMode(nextMode: 'hat' | 'hat-pro') {
    if (!settings) return;
    await saveSettings({ ...settings, mode: nextMode as never });
  }

  async function toggleAutostart() {
    const next = !(settings?.autoLaunch ?? false);
    await hat.app.setAutostart(next);
    if (settings) {
      await saveSettings({ ...settings, autoLaunch: next });
      return;
    }
    await loadSettings();
  }

  async function emergencyQuit() {
    if (!quitConfirm) {
      setQuitConfirm(true);
      return;
    }
    await hat.app.quit();
  }

  return (
    <main className="hat-app">
      <aside className="hat-sidebar">
        <div className="brand-row">
          <div className="brand-symbol">H</div>
          <div>
            <h1>Hat</h1>
            <span>Hat Flash</span>
          </div>
        </div>

        <nav className="main-nav" aria-label="Navegacao">
          <NavButton active={drawer === 'rooms'} icon={RadioTower} label="Sala" onClick={() => setDrawer('rooms')} />
          <NavButton active={drawer === 'clipboard'} icon={Clipboard} label="Clipboard" onClick={() => setDrawer('clipboard')} />
          <NavButton active={drawer === 'system'} icon={Settings} label="Sistema" onClick={() => setDrawer('system')} />
        </nav>

        <section className="history-list">
          <header>
            <span>Fluxo ativo</span>
          </header>
          <button className="history-entry" onClick={() => setDrawer('clipboard')}>
            <strong>Clipboard</strong>
            <span>{inputSummary}</span>
          </button>
          <button className="history-entry" onClick={() => setDrawer('rooms')}>
            <strong>{roomTitle}</strong>
            <span>{roomID ? 'Ativa' : 'Sem sala'}</span>
          </button>
        </section>

        <footer className="sidebar-footer">
          <div className={`live-status ${status}`}>
            <span />
            {isBusy ? activeAction : status === 'error' ? 'Atencao' : 'Pronto'}
          </div>
          <span className="shortcut-footer">{settings?.shortcuts.processClipboardFlash ?? 'Cmd/Ctrl+Shift+F'}</span>
        </footer>
      </aside>

      <section className="chat-pane">
        <header className="top-bar">
          <div>
            <p>{drawer === 'clipboard' ? 'Clipboard' : drawer === 'rooms' ? 'Sala ativa' : 'Sistema'}</p>
            <h2>{drawer === 'clipboard' ? 'Entradas processadas' : drawer === 'rooms' ? 'Salas + consenso' : 'Ajustes'}</h2>
          </div>
          <div className="top-actions">
            <ModeSwitch mode={mode} disabled={!settings || isBusy} onChange={(next) => runGuarded('Salvando modo...', () => setMode(next))} />
            <div className="account-pill">
              <strong>{shortEmail(user?.email)}</strong>
              <span>{credits ?? '--'} creditos</span>
            </div>
            {user ? (
              <button className="icon-button" onClick={() => runGuarded('Saindo...', signOutGoogle)} aria-label="Sair">
                <LogOut size={16} />
              </button>
            ) : (
              <button className="solid-button" onClick={() => runGuarded('Abrindo Google...', async () => { await signInWithGoogle(); })} disabled={isBusy || !firebaseReady}>
                <KeyRound size={15} />
                Entrar
              </button>
            )}
          </div>
        </header>

        {error && (
          <div className="error-line">
            <AlertCircle size={15} />
            <span>{error}</span>
            <button onClick={() => setError('')}>Fechar</button>
          </div>
        )}

        <div className="main-grid">
          <section className="conversation">
            {hasInput && (
              <article className="message user">
                <header>
                  <span>Voce</span>
                  <small>{inputSummary}</small>
                </header>
                <pre>{activeText || 'Imagem anexada.'}</pre>
                {clipboardImage && <img src={clipboardImage} alt="Clipboard" />}
              </article>
            )}

            {thinking && (
              <article className="message thinking">
                <header>
                  <span>Raciocinio</span>
                  <small>stream</small>
                </header>
                <pre>{thinking}</pre>
              </article>
            )}

            {response ? (
              <article className="message assistant">
                <header>
                  <span>Hat</span>
                  <small>{response.length} caracteres</small>
                </header>
                <pre>{response}</pre>
              </article>
            ) : !hasInput ? (
              <div className="empty-chat">
                <Wand2 size={30} />
                <h3>Copie uma pergunta</h3>
                <p>Use o atalho principal para processar, copiar a resposta, mostrar Flash e compartilhar com a sala ativa.</p>
              </div>
            ) : null}
          </section>

          <aside className="drawer-panel">
            <DrawerHeader icon={drawer === 'clipboard' ? Clipboard : drawer === 'rooms' ? RadioTower : Settings} title={drawer === 'clipboard' ? 'Clipboard' : drawer === 'rooms' ? 'Salas' : 'Sistema'} onClose={() => setDrawer('rooms')} />
            {drawer === 'clipboard' && (
              <ClipboardDrawer
                text={activeText}
                image={clipboardImage}
                shortcut={settings?.shortcuts.processClipboardFlash ?? ''}
                busy={isBusy}
                onCapture={() => runGuarded('Lendo clipboard...', processClipboard)}
                onCopy={() => runGuarded('Copiando entrada...', copyInput)}
                onSend={() => runGuarded('Processando...', sendChat)}
                prompt={prompt}
                setPrompt={setPrompt}
              />
            )}
            {drawer === 'rooms' && (
              <RoomsDrawer
                roomTitle={roomTitle}
                setRoomTitle={setRoomTitle}
                roomID={roomID}
                setRoomID={setRoomID}
                busy={isBusy}
                canUse={Boolean(user)}
                onCreate={() => runGuarded('Criando sala...', createRoomFromTitle)}
                onJoin={() => runGuarded('Entrando na sala...', joinCurrentRoom)}
                onLeave={() => runGuarded('Saindo da sala...', leaveCurrentRoom)}
                onCopy={() => runGuarded('Copiando codigo...', copyRoomID)}
              />
            )}
            {drawer === 'system' && (
              <SystemDrawer
                settings={settings}
                updateMessage={updateMessage}
                quitConfirm={quitConfirm}
                busy={isBusy}
                onShortcut={saveShortcut}
                onAutostart={() => runGuarded('Salvando inicio...', toggleAutostart)}
                onUpdate={() => runGuarded('Verificando update...', async () => {
                  const result = await hat.updater.check();
                  setUpdateMessage(result.message);
                })}
                onQuit={() => runGuarded(quitConfirm ? 'Fechando app...' : 'Confirme saida...', emergencyQuit)}
              />
            )}
          </aside>
        </div>

        <footer className="composer-bar">
          <button onClick={() => runGuarded('Lendo clipboard...', processClipboard)} disabled={isBusy} aria-label="Capturar clipboard">
            {isBusy && activeAction.includes('clipboard') ? <Loader2 className="spin" size={16} /> : <Clipboard size={16} />}
            Capturar
          </button>
          <button className="solid-button" onClick={() => runGuarded('Processando clipboard...', processClipboardAndSend)} disabled={!canUseBackend || isBusy}>
            {isBusy && activeAction.includes('Processando') ? <Loader2 className="spin" size={16} /> : <Zap size={16} />}
            Processar Flash
          </button>
          <button onClick={() => hat.chat.cancel(streamID)} disabled={!isBusy} aria-label="Parar">
            <Square size={16} />
          </button>
          <button onClick={() => setDrawer('clipboard')} aria-label="Mais">
            <MoreHorizontal size={16} />
          </button>
        </footer>

        {response && (
          <div className="result-actions">
            <button onClick={() => runGuarded('Copiando resposta...', copyResponse)}>
              <Copy size={14} />
              Copiar
            </button>
            <button onClick={() => runGuarded('Mostrando flash...', flashResponse)}>
              <MonitorUp size={14} />
              Flash
            </button>
            <button onClick={() => setDrawer('rooms')}>
              <RadioTower size={14} />
              Sala
            </button>
          </div>
        )}
      </section>
    </main>
  );
}

function NavButton({ active, icon: Icon, label, onClick }: { active: boolean; icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button className={`nav-button ${active ? 'active' : ''}`} onClick={onClick}>
      <Icon size={17} />
      <span>{label}</span>
    </button>
  );
}

function ModeSwitch({ mode, disabled, onChange }: { mode: string; disabled: boolean; onChange: (mode: 'hat' | 'hat-pro') => void }) {
  return (
    <div className="mode-switch" role="group" aria-label="Modo">
      <button className={mode === 'hat' ? 'active' : ''} onClick={() => onChange('hat')} disabled={disabled}>
        {mode === 'hat' ? <Check size={14} /> : <Zap size={14} />}
        Hat
      </button>
      <button className={mode === 'hat-pro' ? 'active' : ''} onClick={() => onChange('hat-pro')} disabled={disabled}>
        {mode === 'hat-pro' ? <Check size={14} /> : <Sparkles size={14} />}
        Pro
      </button>
    </div>
  );
}

function DrawerHeader({ icon: Icon, title, onClose }: { icon: LucideIcon; title: string; onClose: () => void }) {
  return (
    <header className="drawer-header">
      <div>
        <Icon size={17} />
        <h3>{title}</h3>
      </div>
      <button onClick={onClose} aria-label="Fechar">
        <X size={16} />
      </button>
    </header>
  );
}

function ClipboardDrawer({ text, image, shortcut, busy, onCapture, onCopy, onSend, prompt, setPrompt }: {
  text: string;
  image: string | null;
  shortcut: string;
  busy: boolean;
  onCapture: () => void;
  onCopy: () => void;
  onSend: () => void;
  prompt: string;
  setPrompt: (value: string) => void;
}) {
  return (
    <div className="drawer-body">
      <button className="solid-button full" onClick={onCapture} disabled={busy}>
        <Clipboard size={15} />
        Capturar
      </button>
      <div className="drawer-preview">
        {image && <img src={image} alt="Clipboard" />}
        {text ? <pre>{text}</pre> : <span>Clipboard vazio.</span>}
      </div>
      <textarea className="drawer-textarea" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Editar entrada..." />
      <div className="two-actions">
        <button onClick={onCopy} disabled={!text || busy}><Copy size={14} /> Copiar</button>
        <button onClick={onSend} disabled={!text && !image || busy}><Send size={14} /> Enviar</button>
      </div>
      <InfoLine label="Atalho" value={shortcut || 'Nao definido'} />
    </div>
  );
}

function RoomsDrawer({ roomTitle, setRoomTitle, roomID, setRoomID, busy, canUse, onCreate, onJoin, onLeave, onCopy }: {
  roomTitle: string;
  setRoomTitle: (value: string) => void;
  roomID: string;
  setRoomID: (value: string) => void;
  busy: boolean;
  canUse: boolean;
  onCreate: () => void;
  onJoin: () => void;
  onLeave: () => void;
  onCopy: () => void;
}) {
  return (
    <div className="drawer-body">
      <div className="room-card">
        <Hash size={15} />
        <span>{roomID || 'sem sala ativa'}</span>
      </div>
      <Field label="Nome" value={roomTitle} onChange={setRoomTitle} placeholder="Sala Hat" />
      <Field label="Codigo" value={roomID} onChange={setRoomID} placeholder="Cole o codigo" />
      <p className="drawer-note">Com sala ativa, toda resposta do clipboard entra na sala automaticamente.</p>
      <div className="two-actions">
        <button onClick={onCreate} disabled={!canUse || busy}><RadioTower size={14} /> Criar</button>
        <button onClick={onJoin} disabled={!canUse || !roomID || busy}><DoorOpen size={14} /> Entrar</button>
      </div>
      <div className="two-actions">
        <button onClick={onCopy} disabled={!roomID || busy}><Copy size={14} /> Copiar</button>
        <button onClick={onLeave} disabled={!canUse || !roomID || busy}><LogOut size={14} /> Sair</button>
      </div>
    </div>
  );
}

function SystemDrawer({ settings, updateMessage, quitConfirm, busy, onShortcut, onAutostart, onUpdate, onQuit }: {
  settings: HatSettings | null;
  updateMessage: string;
  quitConfirm: boolean;
  busy: boolean;
  onShortcut: (key: ShortcutKey, value: string) => Promise<void>;
  onAutostart: () => void;
  onUpdate: () => void;
  onQuit: () => void;
}) {
  const shortcutEntries = settings ? (Object.keys(settings.shortcuts) as ShortcutKey[]) : [];

  return (
    <div className="drawer-body">
      <details open>
        <summary>Atalhos</summary>
        {settings && shortcutEntries.map((key) => (
          <ShortcutEditor
            key={key}
            shortcutKey={key}
            value={settings.shortcuts[key]}
            defaultValue={defaultShortcuts[key]}
            conflictLabel={findShortcutConflict(key, settings.shortcuts)}
            disabled={busy}
            onChange={(value) => onShortcut(key, value)}
          />
        ))}
      </details>
      <details>
        <summary>Atualizacao</summary>
        <button className="full" onClick={onUpdate} disabled={busy}><RefreshCw size={14} /> Verificar</button>
        {updateMessage && <p className="drawer-note">{updateMessage}</p>}
        <button className="full" onClick={onAutostart} disabled={busy}><Power size={14} /> {settings?.autoLaunch ? 'Desligar inicio' : 'Iniciar com Windows'}</button>
      </details>
      <details>
        <summary>Seguranca</summary>
        <button className="danger-button full" onClick={onQuit} disabled={busy && quitConfirm}>
          <ShieldAlert size={14} />
          {quitConfirm ? 'Clique de novo' : 'Sair do app'}
        </button>
      </details>
    </div>
  );
}

function ShortcutEditor({ shortcutKey, value, defaultValue, conflictLabel, disabled, onChange }: {
  shortcutKey: ShortcutKey;
  value: string;
  defaultValue: string;
  conflictLabel?: string;
  disabled: boolean;
  onChange: (value: string) => Promise<void>;
}) {
  const captureRef = useRef<HTMLButtonElement>(null);
  const [recording, setRecording] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const meta = shortcutLabels[shortcutKey];
  const isBusy = disabled || saving;

  useEffect(() => {
    if (recording) captureRef.current?.focus();
  }, [recording]);

  async function commitShortcut(nextValue: string) {
    setSaving(true);
    setNotice('');
    try {
      await onChange(nextValue);
      setNotice(nextValue ? 'Salvo' : 'Desativado');
    } catch {
      setNotice('Nao salvou');
    } finally {
      setSaving(false);
      setRecording(false);
    }
  }

  function startRecording() {
    if (isBusy) return;
    setNotice('');
    setRecording(true);
  }

  function handleCaptureKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (!recording) return;
    event.preventDefault();
    event.stopPropagation();

    const result = shortcutFromEvent(event);
    if ('cancelled' in result) {
      setRecording(false);
      setNotice('');
      return;
    }
    if ('error' in result) {
      setNotice(result.error ?? '');
      return;
    }
    void commitShortcut(result.value ?? '');
  }

  return (
    <div className={`shortcut-editor ${recording ? 'recording' : ''}`}>
      <div className="shortcut-meta">
        <span>{meta.label}</span>
        <small>{meta.hint}</small>
      </div>
      <button
        ref={captureRef}
        type="button"
        className="shortcut-capture"
        onClick={startRecording}
        onKeyDown={handleCaptureKeyDown}
        disabled={isBusy}
        aria-label={`Editar ${meta.label}`}
      >
        <ShortcutValue value={value} recording={recording} saving={saving} />
      </button>
      <div className="shortcut-actions">
        <button
          type="button"
          onClick={startRecording}
          disabled={isBusy}
          title="Gravar"
          aria-label={`Gravar ${meta.label}`}
        >
          <Keyboard size={14} />
        </button>
        <button
          type="button"
          onClick={() => void commitShortcut(defaultValue)}
          disabled={isBusy || value === defaultValue}
          title="Padrao"
          aria-label={`Padrao ${meta.label}`}
        >
          <RotateCcw size={14} />
        </button>
        <button
          type="button"
          onClick={() => void commitShortcut('')}
          disabled={isBusy || !value}
          title="Limpar"
          aria-label={`Limpar ${meta.label}`}
        >
          <Trash2 size={14} />
        </button>
      </div>
      {(notice || conflictLabel) && (
        <small className={conflictLabel ? 'shortcut-warning' : 'shortcut-status'}>
          {conflictLabel ? `Conflito: ${conflictLabel}` : notice}
        </small>
      )}
    </div>
  );
}

function ShortcutValue({ value, recording, saving }: { value: string; recording: boolean; saving: boolean }) {
  if (saving) return <span className="shortcut-empty">Salvando...</span>;
  if (recording) return <span className="shortcut-empty">Gravando...</span>;
  const parts = shortcutParts(value);
  if (!parts.length) return <span className="shortcut-empty">Desativado</span>;
  return (
    <span className="shortcut-keys">
      {parts.map((part, index) => (
        <span className="shortcut-token" key={`${part}-${index}`}>
          {index > 0 && <span className="shortcut-plus">+</span>}
          <kbd>{shortcutTokenLabel(part)}</kbd>
        </span>
      ))}
    </span>
  );
}

function findShortcutConflict(key: ShortcutKey, shortcuts: HatSettings['shortcuts']) {
  const value = shortcuts[key]?.trim();
  if (!value) return undefined;
  const conflict = (Object.keys(shortcuts) as ShortcutKey[]).find((candidate) => candidate !== key && shortcuts[candidate] === value);
  return conflict ? shortcutLabels[conflict].label : undefined;
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </label>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="info-line">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
