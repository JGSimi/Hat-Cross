import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Events } from '@wailsio/runtime';
import type { LucideIcon } from 'lucide-react';
import {
  AlertCircle,
  Bot,
  Check,
  Clipboard,
  Copy,
  DoorOpen,
  Hash,
  Loader2,
  LogIn,
  LogOut,
  MonitorUp,
  RadioTower,
  RefreshCw,
  RotateCcw,
  Send,
  Settings,
  ShieldAlert,
  Sparkles,
  Trash2,
  UserCircle,
  Zap,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import {
  firebaseAuth,
  signInWithGoogle,
  signOutGoogle,
  summarizeCredits,
  watchAuth,
  watchCredits,
  type CreditValidityInfo,
} from '../services/firebase';
import { createRoom, joinRoom, leaveRoom } from '../services/rooms';
import { hat, type ChatStreamRequest, type Settings as HatSettings } from '../bridge/hat';
import { useHatStore } from '../stores/hatStore';

type Status = 'idle' | 'busy' | 'error';
type DrawerView = 'rooms' | 'clipboard' | 'system';
type ShortcutKey = keyof HatSettings['shortcuts'];

const shortcutLabels: Record<ShortcutKey, { label: string; hint: string }> = {
  processClipboardFlash: { label: 'Clipboard + Flash', hint: 'Processa e mostra overlay' },
  adjustFlashPosition: { label: 'Flash', hint: 'Ajusta posicao do overlay' },
  emergencyQuit: { label: 'Sair', hint: 'Fecha o app em qualquer tela' },
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
  if (text.includes('network') || text.includes('fetch')) return 'Sem rede.';
  return raw || 'Falhou.';
}

function profileName(user: User) {
  return user.displayName?.trim() || user.email?.split('@')[0] || 'Perfil';
}

function compactCredits(value: number) {
  if (value < 1_000_000) return value.toLocaleString('pt-BR');
  return new Intl.NumberFormat('pt-BR', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
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

function formatExpiryDistance(expiresAt: number, now: number) {
  const diff = expiresAt - now;
  if (diff <= 0) return null;

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'always', style: 'short' });

  if (diff < hour) return rtf.format(Math.max(1, Math.ceil(diff / minute)), 'minute');
  if (diff < 2 * day) return rtf.format(Math.ceil(diff / hour), 'hour');
  if (diff < 60 * day) return rtf.format(Math.ceil(diff / day), 'day');
  return rtf.format(Math.ceil(diff / (30 * day)), 'month');
}

function creditValidityLabel(info: CreditValidityInfo | null, now: number) {
  if (!info) return '';
  if (info.hasLegacyBalanceWithoutLots) return 'sem validade';
  if (!info.nextCreditExpiresAt) return '0 ativo';

  const distance = formatExpiryDistance(info.nextCreditExpiresAt, now);
  if (!distance) return 'vence agora';
  return `${compactCredits(info.creditsExpiringNext)} vence ${distance}`;
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
  const [creditInfo, setCreditInfo] = useState<CreditValidityInfo | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [status, setStatus] = useState<Status>('idle');
  const [activeAction, setActiveAction] = useState('');
  const [error, setError] = useState('');
  const [prompt, setPrompt] = useState('');
  const [roomID, setRoomID] = useState('');
  const [roomTitle, setRoomTitle] = useState('Sala Hat');
  const [updateMessage, setUpdateMessage] = useState('');
  const [quitConfirm, setQuitConfirm] = useState(false);
  const [activeMessageText, setActiveMessageText] = useState('');
  const [activeMessageImage, setActiveMessageImage] = useState<string | null>(null);
  const responseRef = useRef('');

  useEffect(() => {
    const stopAuth = watchAuth((nextUser) => setUser(nextUser));
    return stopAuth;
  }, []);

  useEffect(() => {
    if (!user) {
      setCreditInfo(null);
      return;
    }
    return watchCredits(user.uid, (doc) => setCreditInfo(summarizeCredits(doc)));
  }, [user]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!quitConfirm) return;
    const timer = window.setTimeout(() => setQuitConfirm(false), 3000);
    return () => window.clearTimeout(timer);
  }, [quitConfirm]);

  const isBusy = status === 'busy';
  const canUseBackend = Boolean(user && settings);
  const activeText = (prompt || clipboardText).trim();
  const hasInput = Boolean(activeText || clipboardImage);
  const hasWorkspaceContent = Boolean(activeMessageText || activeMessageImage || thinking || response);
  const mode = settings?.mode ?? 'hat';
  const messageSummary = activeMessageImage ? 'Imagem' : activeMessageText ? 'Texto' : '';
  const credits = creditInfo?.credits ?? null;
  const userName = user ? profileName(user) : '';
  const userEmail = user?.email ?? '';
  const creditAmountLabel = credits === null ? '' : `${compactCredits(credits)} cr`;
  const processShortcut = settings?.shortcuts.processClipboardFlash ?? defaultShortcuts.processClipboardFlash;
  const flashEnabled = settings?.clipboard.flash.enabled ?? true;
  const roomLabel = roomID ? roomTitle || 'Sala Hat' : 'Sem sala';
  const creditExpiryTitle = creditInfo?.nextCreditExpiresAt
    ? new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date(creditInfo.nextCreditExpiresAt))
    : undefined;

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
      roomShare: Boolean(roomID.trim()),
      sourceMessageId: crypto.randomUUID(),
      idempotencyKey: crypto.randomUUID(),
    } satisfies ChatStreamRequest;
  }, [activeText, clipboardImage, mode, roomID, settings, streamID]);

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

  async function sendClipboard() {
    if (!streamRequest || !canUseBackend || !hasInput) return;
    const sentText = activeText || 'Analise o clipboard.';
    setActiveMessageText(sentText);
    setActiveMessageImage(clipboardImage);
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
    setActiveMessageText(text);
    setActiveMessageImage(image);
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
      roomShare: Boolean(roomID.trim()),
      sourceMessageId: crypto.randomUUID(),
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

  async function login() {
    await signInWithGoogle();
  }

  return (
    <main className="hat-app">
      <aside className="hat-sidebar">
        <nav className="main-nav" aria-label="Navegacao">
          <NavButton active={drawer === 'clipboard'} icon={Clipboard} label="Clipboard" onClick={() => setDrawer('clipboard')} />
          <NavButton active={drawer === 'rooms'} icon={RadioTower} label="Salas" onClick={() => setDrawer('rooms')} />
          <NavButton active={drawer === 'system'} icon={Settings} label="Ajustes" onClick={() => setDrawer('system')} />
        </nav>

        <footer className="sidebar-footer">
          <div className={`live-status ${status}`} aria-live="polite">
            <span />
            {isBusy ? activeAction : status === 'error' ? 'Atencao' : user ? 'Pronto' : 'Faca login'}
          </div>
          {user ? (
            <button className="sidebar-profile" onClick={() => setDrawer('system')}>
              <UserAvatar user={user} size={30} />
              <span>
                <strong>{userName}</strong>
                <small>Perfil</small>
              </span>
            </button>
          ) : null}
        </footer>
      </aside>

      <section className="workspace">
        <header className="workspace-header">
          <div className="workspace-title">
            <h1>Hat Flash</h1>
            <div className="status-strip" aria-label="Estado">
              <StatusChip tone={user ? 'ok' : 'warn'} label={user ? 'Conta' : 'Login'} value={user ? userName : 'Pendente'} />
              <StatusChip tone={roomID ? 'ok' : 'muted'} label="Sala" value={roomLabel} />
              <StatusChip tone={flashEnabled ? 'ok' : 'muted'} label="Flash" value={flashEnabled ? 'Ligado' : 'Off'} />
            </div>
          </div>
          <div className="workspace-actions">
            <ModeSwitch mode={mode} disabled={!settings || isBusy} onChange={(next) => runGuarded('Salvando modo...', () => setMode(next))} />
            {user ? (
              <>
                <section className="account-pill" aria-label="Perfil">
                  <UserAvatar user={user} size={34} />
                  <div className="account-copy">
                    <strong>{userName}</strong>
                    <span>{userEmail}</span>
                  </div>
                  <div className="account-credit">
                    {credits !== null && <strong>{creditAmountLabel}</strong>}
                    {creditInfo && <small title={creditExpiryTitle}>{creditValidityLabel(creditInfo, now)}</small>}
                  </div>
                </section>
                <button className="icon-button" onClick={() => runGuarded('Saindo...', signOutGoogle)} aria-label="Sair" title="Sair">
                  <LogOut size={16} />
                </button>
              </>
            ) : null}
          </div>
        </header>

        {error && (
          <div className="error-line">
            <AlertCircle size={15} />
            <span>{error}</span>
            <button onClick={() => setError('')}>Fechar</button>
          </div>
        )}

        <div className="workspace-grid">
          <section className="primary-lane">
            {!user && (
              <AuthPrompt
                busy={isBusy}
                onLogin={() => runGuarded('Abrindo Google...', login)}
              />
            )}

            <section className="command-panel" aria-label="Clipboard">
              <header className="section-header">
                <div>
                  <h2>Clipboard</h2>
                  <span>{roomID ? roomTitle : 'Local'}</span>
                </div>
                <ShortcutInline value={processShortcut} />
              </header>
              <ComposerBar
                prompt={prompt}
                setPrompt={setPrompt}
                isBusy={isBusy}
                activeAction={activeAction}
                canUseBackend={canUseBackend}
                hasInput={hasInput}
                onCapture={() => runGuarded('Lendo clipboard...', processClipboard)}
                onSend={() => runGuarded('Enviando ao Hat...', sendClipboard)}
              />
            </section>

            <WorkspaceFeed
              hasContent={hasWorkspaceContent}
              activeMessageText={activeMessageText}
              activeMessageImage={activeMessageImage}
              messageSummary={messageSummary}
              thinking={thinking}
              response={response}
              roomID={roomID}
              onCopyResponse={() => runGuarded('Copiando resposta...', copyResponse)}
              onFlashResponse={() => runGuarded('Mostrando flash...', flashResponse)}
              onOpenRoom={() => setDrawer('rooms')}
            />
          </section>

          <aside className="side-panel">
            <PanelHeader icon={drawer === 'clipboard' ? Clipboard : drawer === 'rooms' ? RadioTower : Settings} title={drawer === 'clipboard' ? 'Entrada' : drawer === 'rooms' ? 'Sala ativa' : 'Ajustes'} />
              {drawer === 'clipboard' && (
                <ClipboardDrawer
                  text={activeText}
                  image={clipboardImage}
                  shortcut={settings?.shortcuts.processClipboardFlash ?? ''}
                  busy={isBusy}
                  onCapture={() => runGuarded('Lendo clipboard...', processClipboard)}
                  onCopy={() => runGuarded('Copiando entrada...', copyInput)}
                  onSend={() => runGuarded('Enviando ao Hat...', sendClipboard)}
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
      </section>
    </main>
  );
}

function ComposerBar({
  prompt,
  setPrompt,
  isBusy,
  activeAction,
  canUseBackend,
  hasInput,
  onCapture,
  onSend,
}: {
  prompt: string;
  setPrompt: (value: string) => void;
  isBusy: boolean;
  activeAction: string;
  canUseBackend: boolean;
  hasInput: boolean;
  onCapture: () => void;
  onSend: () => void;
}) {
  return (
    <footer className="composer-bar">
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            if (canUseBackend && hasInput && !isBusy) onSend();
          }
        }}
        placeholder="Pergunta..."
        rows={1}
      />
      <button onClick={onCapture} disabled={isBusy} aria-label="Capturar clipboard" title="Capturar clipboard">
        {isBusy && activeAction.includes('clipboard') ? <Loader2 className="spin" size={16} /> : <Clipboard size={16} />}
      </button>
      <button className="solid-button icon-only" onClick={onSend} disabled={!canUseBackend || !hasInput || isBusy} aria-label="Enviar" title="Enviar">
        {isBusy && activeAction.includes('Enviando') ? <Loader2 className="spin" size={16} /> : <Send size={16} />}
      </button>
    </footer>
  );
}

function StatusChip({ tone, label, value }: { tone: 'ok' | 'warn' | 'muted'; label: string; value: string }) {
  return (
    <span className={`status-chip ${tone}`}>
      <small>{label}</small>
      <strong>{value}</strong>
    </span>
  );
}

function ShortcutInline({ value }: { value: string }) {
  const parts = shortcutParts(value);
  if (!parts.length) return <span className="shortcut-inline">Sem atalho</span>;

  return (
    <span className="shortcut-inline" aria-label={value}>
      {parts.map((part, index) => (
        <span className="shortcut-token" key={`${part}-${index}`}>
          {index > 0 && <span className="shortcut-plus">+</span>}
          <kbd>{shortcutTokenLabel(part)}</kbd>
        </span>
      ))}
    </span>
  );
}

function AuthPrompt({ busy, onLogin }: { busy: boolean; onLogin: () => void }) {
  return (
    <section className="auth-panel" aria-label="Login">
      <div>
        <strong>Conta</strong>
        <span>Pendente</span>
      </div>
      <button className="solid-button" onClick={onLogin} disabled={busy}>
        <LogIn size={15} />
        Entrar
      </button>
    </section>
  );
}

function WorkspaceFeed({
  hasContent,
  activeMessageText,
  activeMessageImage,
  messageSummary,
  thinking,
  response,
  roomID,
  onCopyResponse,
  onFlashResponse,
  onOpenRoom,
}: {
  hasContent: boolean;
  activeMessageText: string;
  activeMessageImage: string | null;
  messageSummary: string;
  thinking: string;
  response: string;
  roomID: string;
  onCopyResponse: () => void;
  onFlashResponse: () => void;
  onOpenRoom: () => void;
}) {
  return (
    <section className={`feed-panel ${hasContent ? '' : 'empty'}`} aria-label="Historico">
      {!hasContent && (
        <div className="empty-feed">
          <Clipboard size={20} />
          <strong>Nenhuma entrada</strong>
        </div>
      )}

      {activeMessageText && (
        <article className="message user">
          <header>
            <span>Clipboard</span>
            <small>{messageSummary}</small>
          </header>
          <pre>{activeMessageText}</pre>
          {activeMessageImage && <img src={activeMessageImage} alt="Clipboard" />}
        </article>
      )}

      {thinking && (
        <article className="message thinking">
          <header>
            <span>Processando</span>
          </header>
          <pre>{thinking}</pre>
        </article>
      )}

      {response && (
        <article className="message assistant">
          <header>
            <span><Bot size={14} /> Resposta</span>
            <small>{roomID ? 'Sala' : 'Local'}</small>
          </header>
          <pre>{response}</pre>
          <div className="result-actions">
            <button onClick={onCopyResponse}>
              <Copy size={14} />
              Copiar
            </button>
            <button onClick={onFlashResponse}>
              <MonitorUp size={14} />
              Flash
            </button>
            <button onClick={onOpenRoom}>
              <RadioTower size={14} />
              Sala
            </button>
          </div>
        </article>
      )}
    </section>
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

function UserAvatar({ user, size }: { user: User; size: number }) {
  return (
    <span className="user-avatar" style={{ width: size, height: size }}>
      {user.photoURL ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" /> : <UserCircle size={Math.max(16, size - 12)} />}
    </span>
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

function PanelHeader({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <header className="panel-header">
      <div>
        <Icon size={17} />
        <h3>{title}</h3>
      </div>
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
        {text ? <pre>{text}</pre> : <span>Vazio</span>}
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
  if (!canUse) {
    return (
      <div className="drawer-body">
        <div className="room-card">
          <Hash size={15} />
          <span>Sem sala</span>
        </div>
        <InfoLine label="Conta" value="Pendente" />
      </div>
    );
  }

  return (
    <div className="drawer-body">
      <div className="room-card">
        <Hash size={15} />
        <span>{roomID || 'Sem sala'}</span>
      </div>
      <Field label="Nome" value={roomTitle} onChange={setRoomTitle} placeholder="Sala Hat" />
      <Field label="Codigo" value={roomID} onChange={setRoomID} placeholder="Cole o codigo" />
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
    <div className="drawer-body system-drawer">
      <section className="settings-section">
        <header>
          <div>
            <strong>Atalhos</strong>
          </div>
        </header>
        {settings ? shortcutEntries.map((key) => (
          <ShortcutEditor
            key={key}
            shortcutKey={key}
            value={settings.shortcuts[key]}
            defaultValue={defaultShortcuts[key]}
            conflictLabel={findShortcutConflict(key, settings.shortcuts)}
            disabled={busy}
            onChange={(value) => onShortcut(key, value)}
          />
        )) : (
          <p className="drawer-note">Carregando...</p>
        )}
      </section>
      <section className="settings-section compact">
        <button
          className={`toggle-setting ${settings?.autoLaunch ? 'active' : ''}`}
          onClick={onAutostart}
          disabled={busy}
          aria-pressed={Boolean(settings?.autoLaunch)}
        >
          <span>
            <strong>Iniciar ao ligar o computador</strong>
            <small>{settings?.autoLaunch ? 'Ativado' : 'Desativado'}</small>
          </span>
          <span className="toggle-switch" aria-hidden="true">
            <span />
          </span>
        </button>
      </section>
      <section className="settings-actions">
        <button onClick={onUpdate} disabled={busy}><RefreshCw size={14} /> Atualizar</button>
        <button className="danger-button" onClick={onQuit} disabled={busy && quitConfirm}>
          <ShieldAlert size={14} />
          {quitConfirm ? 'Confirmar' : 'Sair'}
        </button>
        {updateMessage && <p className="drawer-note">{updateMessage}</p>}
      </section>
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
