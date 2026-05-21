import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
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
const DEV_ROOM_ID = 'HF-DEMO-29K';

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

function devSearchParams() {
  if (!import.meta.env.DEV) return null;
  return new URLSearchParams(window.location.search);
}

function devMockRoomID() {
  return devSearchParams()?.has('mockRoom') ? DEV_ROOM_ID : '';
}

function devMockHistory() {
  const params = devSearchParams();
  if (!params?.has('mockHistory')) return null;
  if (params.get('mockHistory') === 'empty') return [];
  return Array.from({ length: MAX_CLIPBOARD_HISTORY }, (_, index) => ({
    id: `dev-history-${index}`,
    createdAt: Date.now() - index * 4 * 60_000,
    text: index === 0
      ? 'Resuma os pontos principais desta reuniao e destaque divergencias.'
      : `Clipboard capturado ${index + 1}`,
    image: null,
    response: index === 2 ? '' : `Resposta pronta ${index + 1} para compartilhar na sala.`,
    roomId: index < 6 ? DEV_ROOM_ID : null,
    roomTitle: 'Sala Hat',
    sharedToRoom: index < 6,
    status: index === 2 ? 'processing' : index === 4 ? 'error' : 'done',
    flashShown: index === 0,
  } satisfies ClipboardHistoryEntry));
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

function devMockUser(): User | null {
  if (!devSearchParams()?.has('mockLogin')) return null;
  return {
    uid: 'dev-preview-user',
    displayName: 'Joao Gabriel',
    email: 'joao2simi@gmail.com',
    photoURL: 'https://lh3.googleusercontent.com/a/default-user=s96-c',
    getIdToken: async () => 'dev-preview-token',
  } as User;
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
  const previewUser = useMemo(() => devMockUser(), []);
  const previewRoomID = useMemo(() => devMockRoomID(), []);
  const settings = useHatStore((s) => s.settings);
  const response = useHatStore((s) => s.response);
  const thinking = useHatStore((s) => s.thinking);
  const streamID = useHatStore((s) => s.streamID);
  const setClipboard = useHatStore((s) => s.setClipboard);
  const resetStream = useHatStore((s) => s.resetStream);
  const saveSettings = useHatStore((s) => s.saveSettings);
  const loadSettings = useHatStore((s) => s.loadSettings);

  const [drawer, setDrawer] = useState<DrawerView>('rooms');
  const [user, setUser] = useState<User | null>(previewUser ?? firebaseAuth?.currentUser ?? null);
  const [creditInfo, setCreditInfo] = useState<CreditValidityInfo | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [status, setStatus] = useState<Status>('idle');
  const [activeAction, setActiveAction] = useState('');
  const [error, setError] = useState('');
  const [roomID, setRoomID] = useState(previewRoomID);
  const [roomCode, setRoomCode] = useState(previewRoomID);
  const [roomTitle, setRoomTitle] = useState('Sala Hat');
  const [updateMessage, setUpdateMessage] = useState('');
  const [quitConfirm, setQuitConfirm] = useState(false);
  const [history, setHistory] = useState<ClipboardHistoryEntry[]>(() => devMockHistory() ?? readClipboardHistory());
  const [activeHistoryID, setActiveHistoryID] = useState(() => history[0]?.id ?? '');
  const responseRef = useRef('');
  const activeHistoryIDRef = useRef(activeHistoryID);

  useEffect(() => {
    if (previewUser) {
      setUser(previewUser);
      return () => undefined;
    }
    const stopAuth = watchAuth((nextUser) => setUser(nextUser));
    return stopAuth;
  }, [previewUser]);

  useEffect(() => {
    if (previewUser) {
      setCreditInfo({
        credits: 800_000_000,
        nextCreditExpiresAt: Date.now() + 9 * 24 * 60 * 60 * 1000,
        creditsExpiringNext: 800_000_000,
        hasLegacyBalanceWithoutLots: false,
      });
      return;
    }
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
  const showingSettings = drawer === 'system';
  const roomEntries = roomID
    ? history.filter((entry) => entry.sharedToRoom && entry.roomId === roomID)
    : [];
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
    const token = await user?.getIdToken();
    if (!token) throw new Error('auth');
    const result = await createRoom(roomTitle.trim() || 'Sala Hat', token);
    setRoomID(result.roomId);
    setRoomCode(result.roomId);
  }

  async function joinCurrentRoom() {
    const token = await user?.getIdToken();
    if (!token) throw new Error('auth');
    const result = await joinRoom(roomCode.trim(), token);
    setRoomID(result.roomId);
    setRoomCode(result.roomId);
  }

  async function leaveCurrentRoom() {
    const token = await user?.getIdToken();
    if (!token || !roomID) throw new Error('auth');
    await leaveRoom(roomID, token);
    setRoomID('');
    setRoomCode('');
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
          <div className="topbar-room-target">
            {roomID ? <span>Sala ativa</span> : <span>{user ? 'Sem sala' : 'Login pendente'}</span>}
          </div>
          <div className="flash-toolbar">
            <ModeSwitch mode={mode} disabled={!settings || isBusy} onChange={(next) => runGuarded('Salvando modo...', () => setMode(next))} />
            {user ? (
              <CompactAccount
                user={user}
                name={userName}
                email={userEmail}
                credits={creditAmountLabel}
                validity={creditInfo ? creditValidityLabel(creditInfo, now) : ''}
                validityTitle={creditExpiryTitle}
              />
            ) : null}
            {user ? (
              <button className="icon-button" onClick={() => runGuarded('Saindo...', signOutGoogle)} aria-label="Sair" title="Sair">
                <LogOut size={16} />
              </button>
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
          <section className="room-main-layout">
            <RoomCommandCenter
              roomTitle={roomTitle}
              setRoomTitle={setRoomTitle}
              roomID={roomID}
              roomCode={roomCode}
              setRoomCode={setRoomCode}
              busy={isBusy}
              canUse={Boolean(user)}
              entries={roomEntries}
              activeEntryID={activeHistoryID}
              thinking={thinking}
              response={response}
              canCapture={canUseBackend}
              isBusy={isBusy}
              activeAction={activeAction}
              onCreate={() => runGuarded('Criando sala...', createRoomFromTitle)}
              onJoin={() => runGuarded('Entrando na sala...', joinCurrentRoom)}
              onLeave={() => runGuarded('Saindo da sala...', leaveCurrentRoom)}
              onCopyRoom={() => runGuarded('Copiando codigo...', copyRoomID)}
              onLogin={() => runGuarded('Abrindo Google...', login)}
              onCapture={() => runGuarded('Processando clipboard...', processClipboardAndSend)}
              onSelectEntry={setActiveHistoryID}
              onCopyResponse={(entryID) => runGuarded('Copiando resposta...', () => copyHistoryResponse(entryID))}
              onFlashResponse={(entryID) => runGuarded('Mostrando flash...', () => flashHistoryResponse(entryID))}
            />
            <ClipboardHistorySurface
              entries={history}
              activeEntryID={activeHistoryID}
              thinking={thinking}
              response={response}
              processShortcut={processShortcut}
              flashEnabled={flashEnabled}
              roomID={roomID}
              canUseBackend={canUseBackend}
              isBusy={isBusy}
              activeAction={activeAction}
              onCapture={() => runGuarded('Processando clipboard...', processClipboardAndSend)}
              onSelect={setActiveHistoryID}
              onCopyResponse={(entryID) => runGuarded('Copiando resposta...', () => copyHistoryResponse(entryID))}
              onFlashResponse={(entryID) => runGuarded('Mostrando flash...', () => flashHistoryResponse(entryID))}
            />
          </section>
        )}
      </section>
    </main>
  );
}

function RoomCommandCenter({
  roomTitle,
  setRoomTitle,
  roomID,
  roomCode,
  setRoomCode,
  busy,
  canUse,
  entries,
  activeEntryID,
  thinking,
  response,
  canCapture,
  isBusy,
  activeAction,
  onCreate,
  onJoin,
  onLeave,
  onCopyRoom,
  onLogin,
  onCapture,
  onSelectEntry,
  onCopyResponse,
  onFlashResponse,
}: {
  roomTitle: string;
  setRoomTitle: (value: string) => void;
  roomID: string;
  roomCode: string;
  setRoomCode: (value: string) => void;
  busy: boolean;
  canUse: boolean;
  entries: ClipboardHistoryEntry[];
  activeEntryID: string;
  thinking: string;
  response: string;
  canCapture: boolean;
  isBusy: boolean;
  activeAction: string;
  onCreate: () => void;
  onJoin: () => void;
  onLeave: () => void;
  onCopyRoom: () => void;
  onLogin: () => void;
  onCapture: () => void;
  onSelectEntry: (entryID: string) => void;
  onCopyResponse: (entryID: string) => void;
  onFlashResponse: (entryID: string) => void;
}) {
  const isActiveRoom = Boolean(roomID);
  const destination = isActiveRoom ? roomTitle || 'Sala Hat' : 'Local';
  const roomControls = canUse ? (
    <section className="room-command-panel" aria-label="Controle da sala">
      <label className="room-field name">
        <span>Nome</span>
        <input value={roomTitle} onChange={(event) => setRoomTitle(event.target.value)} placeholder="Sala Hat" aria-label="Nome da sala" />
      </label>
      <label className="room-field code">
        <span>Codigo</span>
        <input
          value={roomID || roomCode}
          onChange={(event) => setRoomCode(event.target.value)}
          placeholder="Cole o codigo"
          aria-label="Codigo da sala"
          readOnly={Boolean(roomID)}
        />
      </label>
      <div className="room-command-actions">
        <button className="solid-button" onClick={onCreate} disabled={busy}><RadioTower size={14} /> Criar</button>
        <button onClick={onJoin} disabled={Boolean(roomID) || !roomCode.trim() || busy}><DoorOpen size={14} /> Entrar</button>
        <button onClick={onCopyRoom} disabled={!roomID || busy} aria-label="Copiar codigo" title="Copiar codigo"><Copy size={14} /></button>
        <button onClick={onLeave} disabled={!roomID || busy} aria-label="Sair da sala" title="Sair da sala"><LogOut size={14} /></button>
      </div>
    </section>
  ) : (
    <section className="room-auth-card" aria-label="Login">
      <span>
        <small>Conta</small>
        <strong>Login</strong>
      </span>
      <button className="solid-button" onClick={onLogin} disabled={busy}>
        <LogIn size={15} />
        Entrar
      </button>
    </section>
  );

  return (
    <section className={`room-command-center ${isActiveRoom ? 'active' : 'idle'}`} aria-label="Sala">
      <header className="room-center-header">
        <div className="room-title-lockup">
          <RadioTower size={24} />
          <span>
            <small>{isActiveRoom ? 'Sala ativa' : canUse ? 'Sala' : 'Conta'}</small>
            <h2>{isActiveRoom ? roomTitle || 'Sala Hat' : canUse ? 'Criar ou entrar' : 'Entrar no Hat'}</h2>
          </span>
        </div>
        <div className="room-center-status">
          <StatusChip tone={isActiveRoom ? 'ok' : 'warn'} label="Estado" value={isActiveRoom ? 'Conectada' : 'Pendente'} />
          <StatusChip tone={canUse ? 'ok' : 'warn'} label="Conta" value={canUse ? 'Autorizada' : 'Login'} />
        </div>
      </header>

      {!isActiveRoom ? (
        <section className="room-setup-stage" aria-label="Entrada da sala">
          {roomControls}
        </section>
      ) : (
        <>
          <section className="active-room-actions" aria-label="Acoes da sala">
            <button className="room-code-chip" onClick={onCopyRoom} title="Copiar codigo">
              <Copy size={14} />
              {roomID}
            </button>
            <div className="room-share-note">
              <span>Proximo clipboard</span>
              <strong>{destination}</strong>
            </div>
            <button className="solid-button room-capture-main" onClick={onCapture} disabled={!canCapture || isBusy}>
              {isBusy && activeAction.includes('clipboard') ? <Loader2 className="spin" size={16} /> : <Clipboard size={16} />}
              Capturar clipboard
            </button>
            <button onClick={onLeave} disabled={isBusy} aria-label="Sair da sala" title="Sair da sala">
              <LogOut size={14} />
            </button>
          </section>

          <section className="room-activity-panel" aria-label="Atividade da sala">
            <header>
              <span>
                <strong>Atividade</strong>
                <small>{entries.length} envios</small>
              </span>
            </header>
            <RoomActivityList
              entries={entries}
              activeEntryID={activeEntryID}
              thinking={thinking}
              response={response}
              onSelect={onSelectEntry}
              onCopyResponse={onCopyResponse}
              onFlashResponse={onFlashResponse}
            />
          </section>
        </>
      )}
    </section>
  );
}

function ClipboardHistorySurface({
  entries,
  activeEntryID,
  thinking,
  response,
  processShortcut,
  flashEnabled,
  roomID,
  canUseBackend,
  isBusy,
  activeAction,
  onCapture,
  onSelect,
  onCopyResponse,
  onFlashResponse,
}: {
  entries: ClipboardHistoryEntry[];
  activeEntryID: string;
  thinking: string;
  response: string;
  processShortcut: string;
  flashEnabled: boolean;
  roomID: string;
  canUseBackend: boolean;
  isBusy: boolean;
  activeAction: string;
  onCapture: () => void;
  onSelect: (entryID: string) => void;
  onCopyResponse: (entryID: string) => void;
  onFlashResponse: (entryID: string) => void;
}) {
  return (
    <aside className="clipboard-history-surface" aria-label="Clipboard">
      <header className="history-header">
        <div>
          <Clipboard size={19} />
          <span>
            <h2>Historico</h2>
            <small>{entries.length}/{MAX_CLIPBOARD_HISTORY} recentes</small>
          </span>
        </div>
        <button
          className="history-capture-button"
          onClick={onCapture}
          disabled={!canUseBackend || isBusy}
          title="Capturar clipboard"
          aria-label="Capturar clipboard"
        >
          {isBusy && activeAction.includes('clipboard') ? <Loader2 className="spin" size={16} /> : <Clipboard size={16} />}
        </button>
      </header>
      <div className="history-meta">
        <ShortcutInline value={processShortcut} />
        <StatusChip tone={flashEnabled ? 'ok' : 'muted'} label="Flash" value={flashEnabled ? 'Ligado' : 'Off'} />
        <StatusChip tone={roomID ? 'ok' : 'muted'} label="Destino" value={roomID ? 'Sala' : 'Local'} />
      </div>
      <ClipboardHistoryPanel
        entries={entries}
        activeEntryID={activeEntryID}
        thinking={thinking}
        response={response}
        onSelect={onSelect}
        onCopyResponse={onCopyResponse}
        onFlashResponse={onFlashResponse}
      />
    </aside>
  );
}

function RoomActivityList({
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
      <div className="room-activity-empty">
        <RadioTower size={22} />
        <strong>Nenhum envio</strong>
      </div>
    );
  }

  return (
    <div className="room-activity-list">
      {entries.slice(0, MAX_CLIPBOARD_HISTORY).map((entry) => {
        const isActive = entry.id === activeEntryID;
        const liveResponse = isActive && response ? response : entry.response;
        const liveThinking = isActive ? thinking : '';
        const canUseResponse = Boolean(liveResponse);
        return (
          <article
            className={`room-activity-item ${isActive ? 'active' : ''} ${entry.status}`}
            key={entry.id}
            onClick={() => onSelect(entry.id)}
          >
            <header>
              <span>
                <strong>{clipText(entry.text, 112)}</strong>
                <small>{formatEntryTime(entry.createdAt)} · {entry.status === 'processing' ? 'Processando' : entry.status === 'error' ? 'Falhou' : 'Pronto'}</small>
              </span>
            </header>
            {entry.image && <img src={entry.image} alt="Clipboard" />}
            {(liveThinking || liveResponse) && <pre>{liveResponse || liveThinking}</pre>}
            <footer>
              <button onClick={(event) => { event.stopPropagation(); onCopyResponse(entry.id); }} disabled={!canUseResponse}>
                <Copy size={14} />
                Copiar
              </button>
              <button onClick={(event) => { event.stopPropagation(); onFlashResponse(entry.id); }} disabled={!canUseResponse}>
                <MonitorUp size={14} />
                Flash
              </button>
            </footer>
          </article>
        );
      })}
    </div>
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

function CompactAccount({ user, name, email, credits, validity, validityTitle }: {
  user: User;
  name: string;
  email: string;
  credits: string;
  validity: string;
  validityTitle?: string;
}) {
  return (
    <section className="compact-account-chip" aria-label="Perfil" title={email}>
      <UserAvatar user={user} size={28} />
      <span>
        <strong>{credits || name}</strong>
        {validity && <small title={validityTitle}>{validity}</small>}
      </span>
    </section>
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
