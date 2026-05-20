import { useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  AlertCircle,
  Bot,
  Check,
  Clipboard,
  Copy,
  DoorOpen,
  Hash,
  KeyRound,
  Loader2,
  LogOut,
  MessageSquare,
  MonitorUp,
  MoreHorizontal,
  PanelRightOpen,
  Power,
  RadioTower,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldAlert,
  Sparkles,
  Square,
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
type DrawerView = 'chat' | 'clipboard' | 'rooms' | 'system';
type ShortcutKey = keyof HatSettings['shortcuts'];

const shortcutLabels: Record<ShortcutKey, { label: string; hint: string }> = {
  clipboard: { label: 'Clipboard', hint: 'Captura texto e imagem' },
  floatingChat: { label: 'Popover', hint: 'Chat rapido sobre outra janela' },
  adjustFlashPosition: { label: 'Flash', hint: 'Ajusta posicao do overlay' },
  emergencyQuit: { label: 'Sair', hint: 'Fecha o app imediatamente' },
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

  const [drawer, setDrawer] = useState<DrawerView>('chat');
  const [user, setUser] = useState<User | null>(firebaseAuth?.currentUser ?? null);
  const [credits, setCredits] = useState<number | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [activeAction, setActiveAction] = useState('');
  const [error, setError] = useState('');
  const [prompt, setPrompt] = useState('');
  const [roomID, setRoomID] = useState('');
  const [roomTitle, setRoomTitle] = useState('Sala Hat');
  const [roomShare, setRoomShare] = useState(false);
  const [updateMessage, setUpdateMessage] = useState('');
  const [quitConfirm, setQuitConfirm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

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
  const conversationTitle = activeText ? activeText.slice(0, 44) : response ? response.slice(0, 44) : 'Nova conversa';
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
      roomShare,
      sourceMessageId: crypto.randomUUID(),
      idempotencyKey: crypto.randomUUID(),
    } satisfies ChatStreamRequest;
  }, [activeText, clipboardImage, mode, roomID, roomShare, settings, streamID]);

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
    setRoomShare(true);
  }

  async function joinCurrentRoom() {
    const token = await firebaseAuth?.currentUser?.getIdToken();
    if (!token) throw new Error('auth');
    const result = await joinRoom(roomID.trim(), token);
    setRoomID(result.roomId);
    setRoomShare(true);
  }

  async function leaveCurrentRoom() {
    const token = await firebaseAuth?.currentUser?.getIdToken();
    if (!token || !roomID) throw new Error('auth');
    await leaveRoom(roomID, token);
    setRoomID('');
    setRoomShare(false);
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

  function newConversation() {
    resetStream();
    setPrompt('');
    setClipboard('', null);
    setError('');
    setDrawer('chat');
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
          <NavButton active={drawer === 'chat'} icon={MessageSquare} label="Chat" onClick={() => setDrawer('chat')} />
          <NavButton active={drawer === 'clipboard'} icon={Clipboard} label="Clipboard" onClick={() => setDrawer('clipboard')} />
          <NavButton active={drawer === 'rooms'} icon={RadioTower} label="Salas" onClick={() => setDrawer('rooms')} />
          <NavButton active={drawer === 'system'} icon={Settings} label="Sistema" onClick={() => setDrawer('system')} />
        </nav>

        <label className="search-box">
          <Search size={14} />
          <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar" />
        </label>

        <section className="history-list">
          <header>
            <span>Historico</span>
            <button onClick={newConversation} aria-label="Nova conversa">
              <MessageSquare size={14} />
            </button>
          </header>
          <button className="history-entry active" onClick={() => setDrawer('chat')}>
            <strong>{conversationTitle}</strong>
            <span>{response ? 'Resposta pronta' : hasInput ? 'Rascunho' : 'Vazia'}</span>
          </button>
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
          <button className="ghost-button" onClick={() => hat.popover.toggle()}>
            <PanelRightOpen size={15} />
            Popover
          </button>
        </footer>
      </aside>

      <section className="chat-pane">
        <header className="top-bar">
          <div>
            <p>{drawer === 'chat' ? 'Chat' : drawer === 'clipboard' ? 'Clipboard' : drawer === 'rooms' ? 'Salas' : 'Sistema'}</p>
            <h2>{drawer === 'chat' ? 'Conversa principal' : drawer === 'clipboard' ? 'Entrada do Windows' : drawer === 'rooms' ? 'Colaboracao' : 'Ajustes'}</h2>
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
                  <span><Bot size={14} /> Hat</span>
                  <small>{response.length} caracteres</small>
                </header>
                <pre>{response}</pre>
              </article>
            ) : !hasInput ? (
              <div className="empty-chat">
                <Wand2 size={30} />
                <h3>Pronto para trabalhar</h3>
                <p>Escreva, capture o clipboard ou abra um submenu. A tela principal fica limpa.</p>
              </div>
            ) : null}
          </section>

          {drawer !== 'chat' && (
            <aside className="drawer-panel">
              <DrawerHeader icon={drawer === 'clipboard' ? Clipboard : drawer === 'rooms' ? RadioTower : Settings} title={drawer === 'clipboard' ? 'Clipboard' : drawer === 'rooms' ? 'Salas' : 'Sistema'} onClose={() => setDrawer('chat')} />
              {drawer === 'clipboard' && (
                <ClipboardDrawer
                  text={activeText}
                  image={clipboardImage}
                  shortcut={settings?.shortcuts.clipboard ?? ''}
                  busy={isBusy}
                  onCapture={() => runGuarded('Lendo clipboard...', processClipboard)}
                  onCopy={() => runGuarded('Copiando entrada...', copyInput)}
                  onSend={() => runGuarded('Enviando ao Hat...', sendChat)}
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
                  roomShare={roomShare}
                  setRoomShare={setRoomShare}
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
          )}
        </div>

        <footer className="composer-bar">
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Mensagem para o Hat..." rows={1} />
          <button onClick={() => runGuarded('Lendo clipboard...', processClipboard)} disabled={isBusy} aria-label="Capturar clipboard">
            {isBusy && activeAction.includes('clipboard') ? <Loader2 className="spin" size={16} /> : <Clipboard size={16} />}
          </button>
          <button className="solid-button" onClick={() => runGuarded('Enviando ao Hat...', sendChat)} disabled={!canUseBackend || !hasInput || isBusy}>
            {isBusy && activeAction.includes('Enviando') ? <Loader2 className="spin" size={16} /> : <Send size={16} />}
            Enviar
          </button>
          <button onClick={() => hat.chat.cancel(streamID)} disabled={!isBusy} aria-label="Parar">
            <Square size={16} />
          </button>
          <button onClick={() => setDrawer(drawer === 'chat' ? 'clipboard' : 'chat')} aria-label="Mais">
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

function RoomsDrawer({ roomTitle, setRoomTitle, roomID, setRoomID, roomShare, setRoomShare, busy, canUse, onCreate, onJoin, onLeave, onCopy }: {
  roomTitle: string;
  setRoomTitle: (value: string) => void;
  roomID: string;
  setRoomID: (value: string) => void;
  roomShare: boolean;
  setRoomShare: (value: boolean) => void;
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
      <label className="check-row">
        <input type="checkbox" checked={roomShare} onChange={(e) => setRoomShare(e.target.checked)} />
        Compartilhar respostas
      </label>
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
  onShortcut: (key: ShortcutKey, value: string) => void;
  onAutostart: () => void;
  onUpdate: () => void;
  onQuit: () => void;
}) {
  return (
    <div className="drawer-body">
      <details open>
        <summary>Atalhos</summary>
        {settings && (Object.keys(settings.shortcuts) as ShortcutKey[]).map((key) => (
          <label className="shortcut-field" key={key}>
            <span>{shortcutLabels[key].label}</span>
            <small>{shortcutLabels[key].hint}</small>
            <input value={settings.shortcuts[key]} onChange={(e) => onShortcut(key, e.target.value)} />
          </label>
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
