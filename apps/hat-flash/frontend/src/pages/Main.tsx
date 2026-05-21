import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Events } from '@wailsio/runtime';
import type { LucideIcon } from 'lucide-react';
import {
  AlertCircle,
  Check,
  Clipboard,
  Copy,
  DoorOpen,
  Loader2,
  LogIn,
  LogOut,
  MonitorUp,
  RadioTower,
  RefreshCw,
  RotateCcw,
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
type ClipboardHistoryStatus = 'processing' | 'done' | 'error';

interface ClipboardHistoryEntry {
  id: string;
  createdAt: number;
  text: string;
  image: string | null;
  response: string;
  roomId: string | null;
  roomTitle: string;
  sharedToRoom?: boolean;
  status: ClipboardHistoryStatus;
  flashShown: boolean;
}

const MAX_CLIPBOARD_HISTORY = 10;
const CLIPBOARD_HISTORY_STORAGE_KEY = 'hat-flash:clipboard-history:v1';

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

function readClipboardHistory() {
  try {
    const raw = window.localStorage.getItem(CLIPBOARD_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is ClipboardHistoryEntry => Boolean(entry?.id && typeof entry.createdAt === 'number'))
      .slice(0, MAX_CLIPBOARD_HISTORY);
  } catch {
    return [];
  }
}

function persistClipboardHistory(entries: ClipboardHistoryEntry[]) {
  try {
    window.localStorage.setItem(CLIPBOARD_HISTORY_STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_CLIPBOARD_HISTORY)));
  } catch {
    // Ignore private mode or quota failures. Runtime history still works.
  }
}

function clipText(value: string, max = 140) {
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'Imagem';
  return cleaned.length > max ? `${cleaned.slice(0, max - 1)}...` : cleaned;
}

function formatEntryTime(createdAt: number) {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(createdAt));
}

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
  const [roomID, setRoomID] = useState('');
  const [roomTitle, setRoomTitle] = useState('Sala Hat');
  const [updateMessage, setUpdateMessage] = useState('');
  const [quitConfirm, setQuitConfirm] = useState(false);
  const [history, setHistory] = useState<ClipboardHistoryEntry[]>(readClipboardHistory);
  const [activeHistoryID, setActiveHistoryID] = useState(() => history[0]?.id ?? '');
  const responseRef = useRef('');
  const activeHistoryIDRef = useRef(activeHistoryID);

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

  useEffect(() => {
    persistClipboardHistory(history);
  }, [history]);

  useEffect(() => {
    activeHistoryIDRef.current = activeHistoryID;
  }, [activeHistoryID]);

  const isBusy = status === 'busy';
  const canUseBackend = Boolean(user && settings);
  const mode = settings?.mode ?? 'hat';
  const credits = creditInfo?.credits ?? null;
  const userName = user ? profileName(user) : '';
  const userEmail = user?.email ?? '';
  const creditAmountLabel = credits === null ? '' : `${compactCredits(credits)} cr`;
  const processShortcut = settings?.shortcuts.processClipboardFlash ?? defaultShortcuts.processClipboardFlash;
  const flashEnabled = settings?.clipboard.flash.enabled ?? true;
  const stateLabel = isBusy ? activeAction : status === 'error' ? 'Atencao' : user ? 'Pronto' : 'Login pendente';
  const showingSettings = drawer === 'system';
  const creditExpiryTitle = creditInfo?.nextCreditExpiresAt
    ? new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date(creditInfo.nextCreditExpiresAt))
    : undefined;

  useEffect(() => {
    responseRef.current = response;
  }, [response]);

  useEffect(() => {
    const offDone = Events.On('stream:done', (event) => {
      const doneStreamId = Number(event.data?.streamId ?? 0);
      if (doneStreamId !== streamID || !settings) return;
      const finalResponse = responseRef.current;
      if (!finalResponse) return;
      const activeID = activeHistoryIDRef.current;
      if (activeID) {
        setHistory((entries) => entries.map((entry) => (
          entry.id === activeID
            ? { ...entry, response: finalResponse, status: 'done', flashShown: Boolean(settings.clipboard.flash.enabled) }
            : entry
        )));
      }
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

  async function processClipboardAndSend() {
    if (!settings || !canUseBackend) return;
    const payload = await hat.clipboard.process();
    const text = payload.text || 'Analise a imagem do clipboard.';
    const image = payload.image?.dataUrl ?? null;
    const entryID = crypto.randomUUID();
    const entry: ClipboardHistoryEntry = {
      id: entryID,
      createdAt: Date.now(),
      text,
      image,
      response: '',
      roomId: roomID || null,
      roomTitle: roomTitle.trim() || 'Sala Hat',
      sharedToRoom: Boolean(roomID.trim()),
      status: 'processing',
      flashShown: false,
    };
    setClipboard(payload.text, image);
    setDrawer('clipboard');
    setActiveHistoryID(entryID);
    activeHistoryIDRef.current = entryID;
    setHistory((entries) => [entry, ...entries.filter((item) => item.id !== entryID)].slice(0, MAX_CLIPBOARD_HISTORY));
    const nextStream = resetStream();
    try {
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
    } catch (err) {
      setHistory((entries) => entries.map((item) => (item.id === entryID ? { ...item, status: 'error' } : item)));
      throw err;
    }
  }

  function responseForEntry(entry: ClipboardHistoryEntry) {
    if (entry.id === activeHistoryID && response) return response;
    return entry.response;
  }

  async function copyHistoryResponse(entryID: string) {
    const entry = history.find((item) => item.id === entryID);
    const text = entry ? responseForEntry(entry) : response;
    if (text) await hat.clipboard.writeText(text);
  }

  async function copyRoomID() {
    if (roomID) await hat.clipboard.writeText(roomID);
  }

  async function flashHistoryResponse(entryID: string) {
    if (!settings) return;
    const entry = history.find((item) => item.id === entryID);
    const text = entry ? responseForEntry(entry) : response;
    if (!text) return;
    await hat.flash.show({
      text: text.slice(0, settings.clipboard.flash.previewLength),
      position: settings.clipboard.flash.position,
      timing: settings.clipboard.flash.timing,
      appearance: settings.clipboard.flash.appearance,
      streamId: streamID,
    });
    setHistory((entries) => entries.map((item) => (item.id === entryID ? { ...item, flashShown: true } : item)));
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
    <main className="hat-app focus-shell">
      <section className="flash-workbench">
        <header className="flash-topbar">
          <div className="flash-brand">
            <span className="brand-symbol">HF</span>
            <div>
              <h1>Hat Flash</h1>
              <span className={`top-state ${status}`} aria-live="polite">
                <i />
                {stateLabel}
              </span>
            </div>
          </div>
          <div className="flash-toolbar">
            <ModeSwitch mode={mode} disabled={!settings || isBusy} onChange={(next) => runGuarded('Salvando modo...', () => setMode(next))} />
            {user ? (
              <>
                <section className="account-pill compact-account" aria-label="Perfil">
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
            <button
              className={`icon-button ${showingSettings ? 'active' : ''}`}
              onClick={() => setDrawer(showingSettings ? 'rooms' : 'system')}
              aria-label="Ajustes"
              title="Ajustes"
            >
              <Settings size={16} />
            </button>
          </div>
        </header>

        {error && (
          <div className="error-line">
            <AlertCircle size={15} />
            <span>{error}</span>
            <button onClick={() => setError('')}>Fechar</button>
          </div>
        )}

        <RoomRibbon
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
          onLogin={() => runGuarded('Abrindo Google...', login)}
        />

        {showingSettings ? (
          <section className="settings-surface">
            <PanelHeader icon={Settings} title="Ajustes" />
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
          </section>
        ) : (
          <>
            <section className="clipboard-history-surface" aria-label="Clipboard">
              <header className="history-header">
                <div>
                  <Clipboard size={20} />
                  <span>
                    <h2>Clipboard</h2>
                    <small>{history.length}/{MAX_CLIPBOARD_HISTORY} recentes</small>
                  </span>
                </div>
                <button
                  className="solid-button process-button"
                  onClick={() => runGuarded('Processando clipboard...', processClipboardAndSend)}
                  disabled={!canUseBackend || isBusy}
                >
                  {isBusy && activeAction.includes('clipboard') ? <Loader2 className="spin" size={16} /> : <Clipboard size={16} />}
                  Capturar
                </button>
              </header>
              <div className="history-meta">
                <ShortcutInline value={processShortcut} />
                <StatusChip tone={flashEnabled ? 'ok' : 'muted'} label="Flash" value={flashEnabled ? 'Ligado' : 'Off'} />
              </div>
              <ClipboardHistoryPanel
                entries={history}
                activeEntryID={activeHistoryID}
                thinking={thinking}
                response={response}
                onSelect={setActiveHistoryID}
                onCopyResponse={(entryID) => runGuarded('Copiando resposta...', () => copyHistoryResponse(entryID))}
                onFlashResponse={(entryID) => runGuarded('Mostrando flash...', () => flashHistoryResponse(entryID))}
              />
            </section>
          </>
        )}
      </section>
    </main>
  );
}

function RoomRibbon({
  roomTitle,
  setRoomTitle,
  roomID,
  setRoomID,
  busy,
  canUse,
  onCreate,
  onJoin,
  onLeave,
  onCopy,
  onLogin,
}: {
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
  onLogin: () => void;
}) {
  return (
    <section className={`room-ribbon ${roomID ? 'active' : ''}`} aria-label="Sala">
      <div className="room-hero">
        <div className="room-identity">
          <RadioTower size={22} />
          <span>
            <small>Sala ativa</small>
            <strong>{roomID ? roomTitle || 'Sala Hat' : 'Sem sala'}</strong>
          </span>
        </div>
        <div className="room-badges">
          <StatusChip tone={roomID ? 'ok' : 'warn'} label="Estado" value={roomID ? 'Conectada' : 'Pendente'} />
          <StatusChip tone={canUse ? 'ok' : 'warn'} label="Conta" value={canUse ? 'Autorizada' : 'Login'} />
        </div>
      </div>
      {canUse ? (
        <div className="room-form">
          <label>
            <span>Nome</span>
            <input value={roomTitle} onChange={(e) => setRoomTitle(e.target.value)} placeholder="Sala Hat" aria-label="Nome da sala" />
          </label>
          <label>
            <span>Codigo</span>
            <input value={roomID} onChange={(e) => setRoomID(e.target.value)} placeholder="Cole o codigo" aria-label="Codigo da sala" />
          </label>
          <div className="room-buttons">
            <button onClick={onCreate} disabled={busy}><RadioTower size={14} /> Criar</button>
            <button onClick={onJoin} disabled={!roomID || busy}><DoorOpen size={14} /> Entrar</button>
            <button onClick={onCopy} disabled={!roomID || busy} aria-label="Copiar codigo" title="Copiar codigo"><Copy size={14} /></button>
            <button onClick={onLeave} disabled={!roomID || busy} aria-label="Sair da sala" title="Sair da sala"><LogOut size={14} /></button>
          </div>
        </div>
      ) : (
        <div className="room-login-panel">
          <span>
            <small>Conta</small>
            <strong>Login</strong>
          </span>
          <button className="solid-button room-login" onClick={onLogin} disabled={busy}>
            <LogIn size={15} />
            Entrar
          </button>
        </div>
      )}
    </section>
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

function ClipboardHistoryPanel({
  entries,
  activeEntryID,
  thinking,
  response,
  onSelect,
  onCopyResponse,
  onFlashResponse,
}: {
  entries: ClipboardHistoryEntry[];
  activeEntryID: string;
  thinking: string;
  response: string;
  onSelect: (entryID: string) => void;
  onCopyResponse: (entryID: string) => void;
  onFlashResponse: (entryID: string) => void;
}) {
  if (!entries.length) {
    return (
      <section className="history-list empty" aria-label="Historico">
        <Clipboard size={22} />
        <strong>Nenhum clipboard</strong>
      </section>
    );
  }

  return (
    <section className="history-list" aria-label="Historico">
      {entries.slice(0, MAX_CLIPBOARD_HISTORY).map((entry, index) => {
        const isActive = entry.id === activeEntryID;
        const liveResponse = isActive && response ? response : entry.response;
        const liveThinking = isActive ? thinking : '';
        const canUseResponse = Boolean(liveResponse);
        return (
          <article
            className={`history-entry ${isActive ? 'active' : ''} ${entry.status}`}
            key={entry.id}
            onClick={() => onSelect(entry.id)}
          >
            <header>
              <span className="history-index">{String(index + 1).padStart(2, '0')}</span>
              <div>
                <strong>{clipText(entry.text, 96)}</strong>
                <small>{entry.sharedToRoom && entry.roomId ? entry.roomTitle : 'Local'} · {formatEntryTime(entry.createdAt)}</small>
              </div>
              <span className={`history-state ${entry.status}`}>
                {entry.status === 'processing' ? 'Processando' : entry.status === 'error' ? 'Falhou' : 'Pronto'}
              </span>
            </header>
            {entry.image && <img src={entry.image} alt="Clipboard" />}
            {(liveThinking || liveResponse) && (
              <pre className="history-response">
                {liveResponse || liveThinking}
              </pre>
            )}
            <footer>
              <button onClick={(event) => { event.stopPropagation(); onCopyResponse(entry.id); }} disabled={!canUseResponse}>
                <Copy size={14} />
                Copiar
              </button>
              <button onClick={(event) => { event.stopPropagation(); onFlashResponse(entry.id); }} disabled={!canUseResponse}>
                <MonitorUp size={14} />
                Flash
              </button>
              {entry.flashShown && <small>Flash</small>}
            </footer>
          </article>
        );
      })}
    </section>
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
