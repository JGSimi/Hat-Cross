// === Chat Models ===

export interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: number;
  source: 'chat' | 'screenAnalysis' | 'clipboard';
  thinking?: string;
}

export interface ChatAttachment {
  id: string;
  name: string;
  data: string | null;      // base64 for images
  content: string | null;    // text for files
  isImage: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  isPinned: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface DraftEntry {
  text: string;
  updatedAt: number;
}

// === Clipboard History ===

export interface ClipboardEntry {
  id: string;
  originalText: string;
  response: string;
  timestamp: number;
  provider: string;
  model: string;
  images?: string[]; // base64 images captured from clipboard
}

// === AI Models ===

export interface ConversationTurn {
  role: 'user' | 'assistant' | 'system';
  textContent: string;
  images?: string[]; // base64
}

export interface StreamChunk {
  streamId: number;
  text: string;
  isFinished: boolean;
  inputTokens: number | null;
  outputTokens: number | null;
  contentType: 'text' | 'thinking';
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

// === Providers ===
//
// BYOK was removed on 2026-04-16 — all inference now goes through the Hat
// proxy Worker with Firebase-backed credits. The old CloudProvider /
// ProviderConfig / PROVIDER_DEFAULTS exports are gone; anything still
// importing them should migrate to the Hat credits flow.

// === Theme ===

export type AppTheme =
  | 'noir' | 'cappuccino' | 'cyberpunk' | 'minimal' | 'ocean' | 'sunset' | 'forest' | 'lavender' | 'cherry';

export interface ThemePreset {
  name: AppTheme;
  label: string;
  primary: string;
  hover: string;
  bgPrimary: string;
  bgSecondary: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  { name: 'noir', label: 'Noir', primary: '#FFFFFF', hover: '#E0E0E0',
    bgPrimary: '#000000', bgSecondary: '#080808', textPrimary: '#FFFFFF', textSecondary: '#AAAAAA', textMuted: '#666666' },
  { name: 'cappuccino', label: 'Cappuccino', primary: '#C4956A', hover: '#D4A574',
    bgPrimary: '#1C1410', bgSecondary: '#211914', textPrimary: '#E8DDD4', textSecondary: '#C4B5A5', textMuted: '#8A7A6A' },
  { name: 'cyberpunk', label: 'Cyberpunk', primary: '#FF2D6A', hover: '#FF5A8A',
    bgPrimary: '#0A0A12', bgSecondary: '#0E0E1A', textPrimary: '#E0F0FF', textSecondary: '#80C8FF', textMuted: '#4A6A8A' },
  { name: 'minimal', label: 'Minimal', primary: '#666666', hover: '#888888',
    bgPrimary: '#111111', bgSecondary: '#161616', textPrimary: '#D4D4D4', textSecondary: '#999999', textMuted: '#555555' },
  { name: 'ocean', label: 'Oceano', primary: '#0EA5E9', hover: '#38BDF8',
    bgPrimary: '#0B1622', bgSecondary: '#0F1C2A', textPrimary: '#E0F2FE', textSecondary: '#7DD3FC', textMuted: '#3A7AA8' },
  { name: 'sunset', label: 'Pôr do Sol', primary: '#F97316', hover: '#FB923C',
    bgPrimary: '#1A0E08', bgSecondary: '#1E1210', textPrimary: '#FEF3C7', textSecondary: '#FDBA74', textMuted: '#9A6A3A' },
  { name: 'forest', label: 'Floresta', primary: '#16A34A', hover: '#22C55E',
    bgPrimary: '#0A140C', bgSecondary: '#0E1A10', textPrimary: '#DCFCE7', textSecondary: '#86EFAC', textMuted: '#3A7A4A' },
  { name: 'lavender', label: 'Lavanda', primary: '#A78BFA', hover: '#C4B5FD',
    bgPrimary: '#110E18', bgSecondary: '#16121E', textPrimary: '#EDE9FE', textSecondary: '#C4B5FD', textMuted: '#6A5A8A' },
  { name: 'cherry', label: 'Cereja', primary: '#E11D48', hover: '#FB7185',
    bgPrimary: '#180A10', bgSecondary: '#1E0E14', textPrimary: '#FFE4E6', textSecondary: '#FDA4AF', textMuted: '#8A3A4A' },
];

export const VALID_THEMES: AppTheme[] = THEME_PRESETS.map((t) => t.name);

// === Settings ===

export interface PopoverSettings {
  width: number;
  height: number;
  opacity: number;
  vibrancy: boolean;
  stealthMode: boolean;
  stealthHoverOpacity: number;
  disguiseMode: boolean;
  disguiseWidget: 'clock';
  rememberPosition: boolean;
}

export interface ShortcutSettings {
  clipboard: string;
  screenCapture: string;
  floatingChat: string;
}

export interface ClipboardSettings {
  enabled: boolean;
  copyResponseToClipboard: boolean;
  customPrompt: string;
  useCustomPrompt: boolean;
  maxResponseLength: number;
  appendMode: boolean; // append response below original text
  soundOnComplete: boolean;
  captureImages: boolean; // also read images from clipboard
}

export interface NotificationSettings {
  enabled: boolean;
  showProcessingNotification: boolean;
  showResponseNotification: boolean;
  showErrorNotification: boolean;
  showChatResponseNotification: boolean;
  showUpdateNotification: boolean;
  showClipboardEmptyNotification: boolean;
}

export interface ChatLimits {
  maxContextMessages: number;    // Max messages sent as context to AI (prevents context overflow)
  maxConversations: number;      // Max conversations stored in history
  maxMessagesPerConversation: number; // Max messages stored per conversation
  autoNewChatOnLimit: boolean;   // Auto-create new chat when context limit reached
}

export interface AppSettings {
  autoLaunch: boolean;
  soundEnabled: boolean;
  theme: AppTheme;
  popover: PopoverSettings;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  shortcuts: ShortcutSettings;
  tokenStats: TokenUsage;
  clipboard: ClipboardSettings;
  notifications: NotificationSettings;
  chatLimits: ChatLimits;
}

export const DEFAULT_SETTINGS: AppSettings = {
  autoLaunch: false,
  soundEnabled: true,
  theme: 'lavender',
  popover: {
    width: 380,
    height: 480,
    opacity: 1.0,
    vibrancy: false,
    stealthMode: false,
    stealthHoverOpacity: 0.4,
    disguiseMode: true,
    disguiseWidget: 'clock',
    rememberPosition: true,
  },
  systemPrompt: 'Você é um assistente de IA útil e conciso. Responda em português brasileiro.',
  temperature: 0.7,
  maxTokens: 4096,
  shortcuts: {
    clipboard: 'CommandOrControl+Shift+X',
    screenCapture: 'CommandOrControl+Shift+Z',
    floatingChat: 'CommandOrControl+Shift+C',
  },
  tokenStats: {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  },
  clipboard: {
    enabled: true,
    copyResponseToClipboard: true,
    customPrompt: '',
    useCustomPrompt: false,
    maxResponseLength: 4096,
    appendMode: false,
    soundOnComplete: true,
    captureImages: true,
  },
  notifications: {
    enabled: true,
    showProcessingNotification: true,
    showResponseNotification: true,
    showErrorNotification: true,
    showChatResponseNotification: true,
    showUpdateNotification: true,
    showClipboardEmptyNotification: true,
  },
  chatLimits: {
    maxContextMessages: 40,
    maxConversations: 50,
    maxMessagesPerConversation: 200,
    autoNewChatOnLimit: true,
  },
};
