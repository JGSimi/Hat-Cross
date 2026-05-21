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
import { canShareClipboardToRoom, reconcileClipboardRoomShares, visibleMemberCount } from '../services/roomLogic';
import {
  createRoom,
  joinRoom,
  leaveRoom,
  listenRoomData,
  listenUserRoomState,
  type Room,
  type RoomCluster,
  type RoomEntry,
  type RoomMember,
  type RoomNotification,
} from '../services/rooms';
import { hat, type ChatStreamRequest, type Settings as HatSettings } from '../bridge/hat';
import { useHatStore } from '../stores/hatStore';
import type { ClipboardHistoryEntry } from '../types/clipboard';

type Status = 'idle' | 'busy' | 'error';
type DrawerView = 'rooms' | 'clipboard' | 'system';
type ShortcutKey = keyof HatSettings['shortcuts'];

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

function historyDestination(entry: ClipboardHistoryEntry) {
  if (entry.sharedToRoom && entry.roomId) return entry.roomTitle || 'Sala';
  if (entry.roomSharePending) return 'Sala pendente';
  if (entry.roomShareError) return 'Share recusado';
  return 'Local';
}

function divergenceFlashText(notification: RoomNotification) {
  if (notification.message.trim().startsWith('Resposta correta é')) return notification.message.trim();
  const answer = notification.suggestedCorrectOptionLabel
    ? `(${notification.suggestedCorrectOptionLabel})`
    : notification.suggestedCorrectAnswer || 'revise';
  const preview = clipText(notification.questionPreview || 'Pergunta', 112);
  return `Resposta correta é ${answer} para pergunta: ${preview}`;
}

function devSearchParams() {
  if (!import.meta.env.DEV) return null;
  return new URLSearchParams(window.location.search);
}

function devMockRoomID() {
  return devSearchParams()?.has('mockRoom') ? DEV_ROOM_ID : '';
}

function devMockMemberCount() {
  const raw = devSearchParams()?.get('mockMembers');
  const parsed = raw ? Number.parseInt(raw, 10) : 2;
  return Number.isFinite(parsed) ? Math.max(1, parsed) : 2;
}

function devMockRoom(): Room | null {
  if (!devMockRoomID()) return null;
  const now = Date.now();
  return {
    id: DEV_ROOM_ID,
    title: 'Sala Hat',
    ownerUid: 'dev-preview-user',
    status: 'open',
    joinCost: 800,
    createdAt: now - 60 * 60_000,
    updatedAt: now,
    memberCount: devMockMemberCount(),
  };
}

function devMockRooms(): Room[] {
  const active = devMockRoom();
  if (active) return [active];
  if (!devSearchParams()?.has('mockLogin')) return [];
  const now = Date.now();
  return [
    {
      id: 'HF-ABRIR-1',
      title: 'Sala revisão',
      ownerUid: 'dev-preview-user',
      status: 'open',
      joinCost: 800,
      createdAt: now - 2 * 60 * 60_000,
      updatedAt: now - 18 * 60_000,
      memberCount: 1,
    },
  ];
}

function devMockMembers(): RoomMember[] {
  if (!devMockRoomID()) return [];
  return Array.from({ length: devMockMemberCount() }, (_, index) => ({
    uid: index === 0 ? 'dev-preview-user' : `dev-member-${index}`,
    role: index === 0 ? 'owner' : 'member',
    displayName: index === 0 ? 'Joao Gabriel' : `Membro ${index + 1}`,
    photoURL: null,
    paidAt: Date.now() - 50 * 60_000,
    lastSeenAt: Date.now() - index * 2 * 60_000,
    creditsCharged: 800,
  }));
}

function devMockRoomEntries(): RoomEntry[] {
  if (!devMockRoomID() || devMockMemberCount() < 2) return [];
  return Array.from({ length: 5 }, (_, index) => ({
    id: `dev-room-entry-${index}`,
    uid: index % 2 === 0 ? 'dev-preview-user' : 'dev-member-1',
    questionText: index === 0
      ? 'Resuma os pontos principais desta reuniao e destaque divergencias.'
      : `Pergunta compartilhada ${index + 1}`,
    aiAnswer: `Resposta real da sala ${index + 1}.`,
    extractedAnswer: index === 4 ? 'Divergente' : 'Consenso',
    normalizedQuestion: index === 0
      ? 'resuma os pontos principais desta reuniao e destaque divergencias'
      : `pergunta compartilhada ${index + 1}`,
    answerOptions: [],
    selectedOptionLabel: null,
    selectedOptionText: null,
    canonicalAnswerText: index === 4 ? 'Divergente' : 'Consenso',
    questionPreview: index === 0
      ? 'Resuma os pontos principais desta reuniao e destaque divergencias.'
      : `Pergunta compartilhada ${index + 1}`,
    answerType: 'short_text',
    confidence: index === 4 ? 0.61 : 0.86,
    mode: 'hat',
    createdAt: Date.now() - index * 4 * 60_000,
    sourceMessageId: `dev-history-${index}`,
    clusterId: 'dev-cluster-1',
  } satisfies RoomEntry));
}

function devMockClusters(): RoomCluster[] {
  if (!devMockRoomID() || devMockMemberCount() < 2) return [];
  return [{
    id: 'dev-cluster-1',
    canonicalQuestion: 'Resuma os pontos principais desta reuniao.',
    answerType: 'short_text',
    consensusAnswer: 'Consenso',
    consensusAnswerText: 'Consenso',
    consensusConfidence: 0.8,
    entryIds: ['dev-room-entry-0', 'dev-room-entry-1', 'dev-room-entry-2'],
    divergentEntryIds: ['dev-room-entry-4'],
    updatedAt: Date.now(),
  }];
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
    sourceMessageId: `dev-history-${index}`,
    sharedToRoom: index < 5,
    roomSharePending: false,
    roomShareError: false,
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
  const [rooms, setRooms] = useState<Room[]>(() => devMockRooms());
  const [activeRoom, setActiveRoom] = useState<Room | null>(() => devMockRoom());
  const [roomMembers, setRoomMembers] = useState<RoomMember[]>(() => devMockMembers());
  const [roomEntries, setRoomEntries] = useState<RoomEntry[]>(() => devMockRoomEntries());
  const [roomClusters, setRoomClusters] = useState<RoomCluster[]>(() => devMockClusters());
  const [roomNotifications, setRoomNotifications] = useState<RoomNotification[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [roomError, setRoomError] = useState('');
  const [updateMessage, setUpdateMessage] = useState('');
  const [quitConfirm, setQuitConfirm] = useState(false);
  const [history, setHistory] = useState<ClipboardHistoryEntry[]>(() => devMockHistory() ?? readClipboardHistory());
  const [activeHistoryID, setActiveHistoryID] = useState(() => history[0]?.id ?? '');
  const responseRef = useRef('');
  const activeHistoryIDRef = useRef(activeHistoryID);
  const roomShareTimersRef = useRef<Map<string, number>>(new Map());
  const shownNotificationIDsRef = useRef<Set<string>>(new Set());

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
    if (previewUser) return undefined;
    if (!user) {
      setRooms([]);
      setActiveRoom(null);
      setRoomMembers([]);
      setRoomEntries([]);
      setRoomClusters([]);
      setRoomNotifications([]);
      setRoomID('');
      setRoomCode('');
      setRoomsLoading(false);
      setRoomError('');
      return undefined;
    }

    setRoomsLoading(true);
    return listenUserRoomState(
      user.uid,
      ({ activeRoomId, rooms: nextRooms }) => {
        const nextActiveRoom = activeRoomId
          ? nextRooms.find((room) => room.id === activeRoomId) ?? null
          : null;
        setRooms(nextRooms);
        setRoomID(activeRoomId ?? '');
        setRoomCode(activeRoomId ?? '');
        if (nextActiveRoom) {
          setActiveRoom(nextActiveRoom);
          setRoomTitle(nextActiveRoom.title);
        } else if (!activeRoomId) {
          setActiveRoom(null);
          setRoomMembers([]);
          setRoomEntries([]);
          setRoomClusters([]);
          setRoomNotifications([]);
        }
        setRoomsLoading(false);
        setRoomError('');
      },
      (err) => {
        setRoomsLoading(false);
        setRoomError(friendlyError(err));
      },
    );
  }, [previewUser, user]);

  useEffect(() => {
    if (previewUser) return undefined;
    if (!user || !roomID) {
      setActiveRoom(null);
      setRoomMembers([]);
      setRoomEntries([]);
      setRoomClusters([]);
      setRoomNotifications([]);
      return undefined;
    }

    return listenRoomData(roomID, user.uid, {
      onRoom: (room) => {
        setActiveRoom(room);
        if (room) {
          setRoomTitle(room.title);
          setRoomCode(room.id);
          setRoomError('');
        }
      },
      onMembers: setRoomMembers,
      onEntries: setRoomEntries,
      onClusters: setRoomClusters,
      onNotifications: setRoomNotifications,
      onError: (err) => setRoomError(friendlyError(err)),
    });
  }, [previewUser, roomID, user]);

  useEffect(() => {
    persistClipboardHistory(history);
  }, [history]);

  useEffect(() => {
    activeHistoryIDRef.current = activeHistoryID;
  }, [activeHistoryID]);

  useEffect(() => {
    setHistory((entries) => reconcileClipboardRoomShares(entries, roomEntries));
  }, [roomEntries]);

  useEffect(() => {
    if (!settings || !roomNotifications.length) return;
    const next = roomNotifications
      .filter((notification) => (
        notification.kind === 'divergence' &&
        notification.severity === 'error' &&
        !notification.readAt &&
        !notification.seenAt &&
        !shownNotificationIDsRef.current.has(notification.id)
      ))
      .sort((a, b) => a.createdAt - b.createdAt);
    if (!next.length) return;
    for (const notification of next) {
      shownNotificationIDsRef.current.add(notification.id);
    }
    const latest = next[next.length - 1];
    void hat.flash.show({
      text: divergenceFlashText(latest),
      position: settings.clipboard.flash.position,
      timing: {
        ...settings.clipboard.flash.timing,
        mode: 'fade',
        holdMs: Math.max(settings.clipboard.flash.timing.holdMs ?? 0, 3600),
      },
      appearance: {
        ...settings.clipboard.flash.appearance,
        color: '#ff4d5d',
        opacity: 100,
        textShadow: true,
      },
      streamId: streamID,
    });
  }, [roomNotifications, settings, streamID]);

  useEffect(() => () => {
    for (const timer of roomShareTimersRef.current.values()) {
      window.clearTimeout(timer);
    }
    roomShareTimersRef.current.clear();
  }, []);

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
  const activeMemberCount = visibleMemberCount(activeRoom, roomMembers.length);
  const canShareActiveRoom = canShareClipboardToRoom(activeRoom, activeMemberCount);
  const isWaitingForRoomMember = Boolean(activeRoom && activeMemberCount < 2);
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

  function watchRoomShareConfirmation(entryID: string) {
    const existing = roomShareTimersRef.current.get(entryID);
    if (existing) window.clearTimeout(existing);
    const timer = window.setTimeout(() => {
      roomShareTimersRef.current.delete(entryID);
      setHistory((entries) => entries.map((entry) => (
        entry.id === entryID && entry.roomSharePending
          ? { ...entry, sharedToRoom: false, roomSharePending: false, roomShareError: true }
          : entry
      )));
    }, 18_000);
    roomShareTimersRef.current.set(entryID, timer);
  }

  async function processClipboardAndSend() {
    if (!settings || !canUseBackend) return;
    const payload = await hat.clipboard.process();
    const text = payload.text || 'Analise a imagem do clipboard.';
    const image = payload.image?.dataUrl ?? null;
    const entryID = crypto.randomUUID();
    const shareRoom = canShareActiveRoom && activeRoom ? activeRoom : null;
    const sourceMessageId = shareRoom ? entryID : null;
    const entry: ClipboardHistoryEntry = {
      id: entryID,
      createdAt: Date.now(),
      text,
      image,
      response: '',
      roomId: activeRoom?.id ?? (roomID || null),
      roomTitle: activeRoom?.title ?? (roomTitle.trim() || 'Sala Hat'),
      sourceMessageId,
      sharedToRoom: false,
      roomSharePending: Boolean(shareRoom),
      roomShareError: false,
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
        roomId: shareRoom?.id ?? null,
        roomShare: Boolean(shareRoom),
        sourceMessageId,
        idempotencyKey: crypto.randomUUID(),
      });
      if (shareRoom) watchRoomShareConfirmation(entryID);
    } catch (err) {
      setHistory((entries) => entries.map((item) => (
        item.id === entryID
          ? { ...item, status: 'error', roomSharePending: false, roomShareError: Boolean(shareRoom) }
          : item
      )));
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

  async function copyRoomEntry(entryID: string) {
    const entry = roomEntries.find((item) => item.id === entryID || item.sourceMessageId === entryID);
    if (entry?.aiAnswer) await hat.clipboard.writeText(entry.aiAnswer);
  }

  async function flashRoomEntry(entryID: string) {
    if (!settings) return;
    const entry = roomEntries.find((item) => item.id === entryID || item.sourceMessageId === entryID);
    if (!entry?.aiAnswer) return;
    await hat.flash.show({
      text: entry.aiAnswer.slice(0, settings.clipboard.flash.previewLength),
      position: settings.clipboard.flash.position,
      timing: settings.clipboard.flash.timing,
      appearance: settings.clipboard.flash.appearance,
      streamId: streamID,
    });
  }

  async function createRoomFromTitle() {
    const token = await user?.getIdToken();
    if (!token) throw new Error('auth');
    const result = await createRoom(roomTitle.trim() || 'Sala Hat', token);
    setRoomID(result.roomId);
    setRoomCode(result.roomId);
  }

  async function joinCurrentRoom() {
    await joinRoomByID(roomCode.trim());
  }

  async function joinRoomByID(nextRoomID: string) {
    const token = await user?.getIdToken();
    if (!token) throw new Error('auth');
    const result = await joinRoom(nextRoomID, token);
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
          <div className={`topbar-room-target ${roomID ? 'active' : user ? 'ready' : 'warn'}`}>
            <span>{roomID ? activeRoom?.title || roomTitle || 'Sala Hat' : user ? 'Escolha uma sala' : 'Conta desconectada'}</span>
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
              rooms={rooms}
              activeRoom={activeRoom}
              memberCount={activeMemberCount}
              clusters={roomClusters}
              notifications={roomNotifications}
              roomsLoading={roomsLoading}
              roomError={roomError}
              waitingForMember={isWaitingForRoomMember}
              busy={isBusy}
              canUse={Boolean(user)}
              entries={roomEntries}
              activeEntryID={activeHistoryID}
              canCapture={canUseBackend}
              isBusy={isBusy}
              activeAction={activeAction}
              onCreate={() => runGuarded('Criando sala...', createRoomFromTitle)}
              onJoin={() => runGuarded('Entrando na sala...', joinCurrentRoom)}
              onJoinRoom={(nextRoomID) => runGuarded('Entrando na sala...', () => joinRoomByID(nextRoomID))}
              onLeave={() => runGuarded('Saindo da sala...', leaveCurrentRoom)}
              onCopyRoom={() => runGuarded('Copiando codigo...', copyRoomID)}
              onLogin={() => runGuarded('Abrindo Google...', login)}
              onCapture={() => runGuarded('Processando clipboard...', processClipboardAndSend)}
              onSelectEntry={setActiveHistoryID}
              onCopyResponse={(entryID) => runGuarded('Copiando resposta...', () => copyRoomEntry(entryID))}
              onFlashResponse={(entryID) => runGuarded('Mostrando flash...', () => flashRoomEntry(entryID))}
            />
            <ClipboardHistorySurface
              entries={history}
              activeEntryID={activeHistoryID}
              thinking={thinking}
              response={response}
              processShortcut={processShortcut}
              flashEnabled={flashEnabled}
              roomDestination={canShareActiveRoom ? 'Sala' : activeRoom ? 'Aguarda' : 'Local'}
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
  rooms,
  activeRoom,
  memberCount,
  clusters,
  notifications,
  roomsLoading,
  roomError,
  waitingForMember,
  busy,
  canUse,
  entries,
  activeEntryID,
  canCapture,
  isBusy,
  activeAction,
  onCreate,
  onJoin,
  onJoinRoom,
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
  rooms: Room[];
  activeRoom: Room | null;
  memberCount: number;
  clusters: RoomCluster[];
  notifications: RoomNotification[];
  roomsLoading: boolean;
  roomError: string;
  waitingForMember: boolean;
  busy: boolean;
  canUse: boolean;
  entries: RoomEntry[];
  activeEntryID: string;
  canCapture: boolean;
  isBusy: boolean;
  activeAction: string;
  onCreate: () => void;
  onJoin: () => void;
  onJoinRoom: (roomID: string) => void;
  onLeave: () => void;
  onCopyRoom: () => void;
  onLogin: () => void;
  onCapture: () => void;
  onSelectEntry: (entryID: string) => void;
  onCopyResponse: (entryID: string) => void;
  onFlashResponse: (entryID: string) => void;
}) {
  const isActiveRoom = Boolean(roomID);
  const heading = isActiveRoom ? activeRoom?.title || roomTitle || 'Sala Hat' : canUse ? 'Escolher sala' : 'Entrar no Hat';
  const eyebrow = isActiveRoom ? 'Sala ativa' : canUse ? 'Sala' : 'Conta';
  const destination = isActiveRoom ? activeRoom?.title || roomTitle || 'Sala Hat' : 'Local';
  const headerStatus: Array<{ tone: 'ok' | 'warn' | 'muted'; label: string; value: string }> = isActiveRoom
    ? [
      { tone: waitingForMember ? 'warn' : 'ok', label: 'Membros', value: String(memberCount) },
      { tone: activeRoom?.status === 'open' ? 'ok' : 'warn', label: 'Estado', value: activeRoom?.status === 'open' ? 'Aberta' : 'Pendente' },
    ]
    : canUse
      ? [
        { tone: 'warn', label: 'Sala', value: 'Sem sala' },
        { tone: 'ok', label: 'Conta', value: 'Ok' },
      ]
      : [];
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
          placeholder="HF-..."
          aria-label="Codigo da sala"
          readOnly={Boolean(roomID)}
        />
      </label>
      <div className="room-command-actions">
        <button className="solid-button" onClick={onCreate} disabled={busy}><RadioTower size={14} /> Criar sala</button>
        <button onClick={onJoin} disabled={Boolean(roomID) || !roomCode.trim() || busy}><DoorOpen size={14} /> Entrar</button>
      </div>
    </section>
  ) : (
    <section className="room-auth-card" aria-label="Login">
      <span>
        <small>Acesso</small>
        <strong>Google</strong>
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
            <small>{eyebrow}</small>
            <h2>{heading}</h2>
          </span>
        </div>
        {headerStatus.length > 0 && (
          <div className="room-center-status">
            {headerStatus.map((chip) => <StatusChip key={`${chip.label}-${chip.value}`} {...chip} />)}
          </div>
        )}
      </header>

      {!isActiveRoom ? (
        <section className="room-setup-stage" aria-label="Entrada da sala">
          {roomControls}
          {canUse && (
            <OpenRoomsList
              rooms={rooms}
              loading={roomsLoading}
              activeRoomId={roomID}
              onJoinRoom={onJoinRoom}
            />
          )}
        </section>
      ) : (
        <>
          {roomError && (
            <div className="room-warning-line">
              <AlertCircle size={14} />
              <span>{roomError}</span>
            </div>
          )}
          <section className="active-room-actions" aria-label="Acoes da sala">
            <button className="room-code-chip" onClick={onCopyRoom} title="Copiar codigo">
              <Copy size={14} />
              {roomID}
            </button>
            <div className="room-share-note">
              <span>{waitingForMember ? 'Proximo clipboard' : 'Comparacao'}</span>
              <strong>{waitingForMember ? 'Grava na sala' : destination}</strong>
            </div>
            <button className="solid-button room-capture-main" onClick={onCapture} disabled={!canCapture || isBusy}>
              {isBusy && activeAction.includes('clipboard') ? <Loader2 className="spin" size={16} /> : <Clipboard size={16} />}
              Capturar clipboard
            </button>
            <button onClick={onLeave} disabled={isBusy} aria-label="Sair da sala" title="Sair da sala">
              <LogOut size={14} />
            </button>
          </section>

          {waitingForMember ? (
            <section className="room-waiting-stack" aria-label="Aguardando comparacao">
              <section className="room-waiting-panel">
                <RadioTower size={22} />
                <span>
                  <strong>Aguardando outro membro</strong>
                  <small>Envios ja ficam gravados. Comparacao comeca com 2+ membros.</small>
                </span>
              </section>
              <section className="room-activity-panel compact" aria-label="Atividade da sala">
                <header>
                  <span>
                    <strong>Atividade real</strong>
                    <small>{entries.length} envio(s) gravados</small>
                  </span>
                </header>
                <RoomActivityList
                  entries={entries}
                  activeEntryID={activeEntryID}
                  onSelect={onSelectEntry}
                  onCopyResponse={onCopyResponse}
                  onFlashResponse={onFlashResponse}
                />
              </section>
            </section>
          ) : (
            <section className="room-live-grid">
              <section className="room-activity-panel" aria-label="Atividade da sala">
                <header>
                  <span>
                    <strong>Atividade real</strong>
                    <small>{entries.length} envios gravados</small>
                  </span>
                </header>
                <RoomActivityList
                  entries={entries}
                  activeEntryID={activeEntryID}
                  onSelect={onSelectEntry}
                  onCopyResponse={onCopyResponse}
                  onFlashResponse={onFlashResponse}
                />
              </section>
              <RoomConsensusSummary clusters={clusters} entries={entries} notifications={notifications} />
            </section>
          )}
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
  roomDestination,
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
  roomDestination: string;
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
        <StatusChip tone={roomDestination === 'Sala' ? 'ok' : 'muted'} label="Destino" value={roomDestination} />
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

function OpenRoomsList({
  rooms,
  loading,
  activeRoomId,
  onJoinRoom,
}: {
  rooms: Room[];
  loading: boolean;
  activeRoomId: string;
  onJoinRoom: (roomID: string) => void;
}) {
  if (loading) {
    return (
      <section className="open-rooms-panel" aria-label="Salas abertas">
        <strong>Salas</strong>
        <small>Carregando...</small>
      </section>
    );
  }

  if (!rooms.length) {
    return (
      <section className="open-rooms-panel empty" aria-label="Salas abertas">
        <strong>Sem salas abertas</strong>
      </section>
    );
  }

  return (
    <section className="open-rooms-panel" aria-label="Salas abertas">
      <header>
        <strong>Salas abertas</strong>
        <small>{rooms.length}</small>
      </header>
      <div>
        {rooms.slice(0, 4).map((room) => (
          <button key={room.id} onClick={() => onJoinRoom(room.id)} disabled={activeRoomId === room.id}>
            <span>
              <strong>{room.title}</strong>
              <small>{room.memberCount} membro(s) · {room.id}</small>
            </span>
            <DoorOpen size={14} />
          </button>
        ))}
      </div>
    </section>
  );
}

function RoomActivityList({
  entries,
  activeEntryID,
  onSelect,
  onCopyResponse,
  onFlashResponse,
}: {
  entries: RoomEntry[];
  activeEntryID: string;
  onSelect: (entryID: string) => void;
  onCopyResponse: (entryID: string) => void;
  onFlashResponse: (entryID: string) => void;
}) {
  if (!entries.length) {
    return (
      <div className="room-activity-empty">
        <RadioTower size={22} />
        <strong>Sem envios</strong>
      </div>
    );
  }

  return (
    <div className="room-activity-list">
      {entries.slice(0, MAX_CLIPBOARD_HISTORY).map((entry) => {
        const isActive = entry.sourceMessageId === activeEntryID || entry.id === activeEntryID;
        const canUseResponse = Boolean(entry.aiAnswer);
        return (
          <article
            className={`room-activity-item ${isActive ? 'active' : ''}`}
            key={entry.id}
            onClick={() => onSelect(entry.sourceMessageId || entry.id)}
          >
            <header>
              <span>
                <strong>{clipText(entry.questionText, 112)}</strong>
                <small>{formatEntryTime(entry.createdAt)} · {entry.mode}</small>
              </span>
            </header>
            {entry.aiAnswer && <pre>{entry.aiAnswer}</pre>}
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

function RoomConsensusSummary({
  clusters,
  entries,
  notifications,
}: {
  clusters: RoomCluster[];
  entries: RoomEntry[];
  notifications: RoomNotification[];
}) {
  const primary = clusters[0] ?? null;
  const divergentCount = clusters.reduce((sum, cluster) => sum + cluster.divergentEntryIds.length, 0);
  const unreadCount = notifications.filter((item) => !item.readAt).length;

  return (
    <aside className="room-consensus-summary" aria-label="Consenso">
      <header>
        <strong>Consenso</strong>
        <small>{clusters.length} grupo(s)</small>
      </header>
      {primary ? (
        <div className="consensus-card">
          <small>{clipText(primary.canonicalQuestion, 86)}</small>
          <strong>{primary.consensusAnswerText ?? String(primary.consensusAnswer ?? 'Pendente')}</strong>
          <span>{Math.round(primary.consensusConfidence * 100)}% · {primary.entryIds.length} resposta(s)</span>
        </div>
      ) : (
        <div className="consensus-empty">
          <strong>Sem consenso</strong>
          <small>{entries.length ? 'Aguardando novas respostas.' : 'Aguardando atividade real.'}</small>
        </div>
      )}
      <div className="consensus-metrics">
        <span>
          <small>Divergencias</small>
          <strong>{divergentCount}</strong>
        </span>
        <span>
          <small>Alertas</small>
          <strong>{unreadCount}</strong>
        </span>
      </div>
    </aside>
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
        <strong>Sem capturas</strong>
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
                <small>{historyDestination(entry)} · {formatEntryTime(entry.createdAt)}</small>
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
