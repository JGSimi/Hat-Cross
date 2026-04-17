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
  isPinned?: boolean;
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
  | 'noir' | 'cappuccino' | 'cyberpunk' | 'minimal' | 'ocean' | 'sunset' | 'forest' | 'lavender' | 'cherry'
  | 'matrix' | 'dracula' | 'nord' | 'monokai' | 'synthwave' | 'terminal' | 'rosegold' | 'midnight'
  | 'obsidian' | 'aurora' | 'sakura' | 'ice' | 'solarized' | 'tokyo' | 'gruvbox';

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
  { name: 'matrix', label: 'Matrix', primary: '#00FF41', hover: '#4AFF7A',
    bgPrimary: '#000000', bgSecondary: '#040A04', textPrimary: '#D0FFD0', textSecondary: '#8ACC8A', textMuted: '#3E6B3E' },
  { name: 'dracula', label: 'Drácula', primary: '#BD93F9', hover: '#CAA8FA',
    bgPrimary: '#282A36', bgSecondary: '#2E303E', textPrimary: '#F8F8F2', textSecondary: '#BFBFB7', textMuted: '#6272A4' },
  { name: 'nord', label: 'Nord', primary: '#88C0D0', hover: '#A5D0DE',
    bgPrimary: '#2E3440', bgSecondary: '#3B4252', textPrimary: '#ECEFF4', textSecondary: '#D8DEE9', textMuted: '#4C566A' },
  { name: 'monokai', label: 'Monokai', primary: '#F92672', hover: '#FD5C94',
    bgPrimary: '#272822', bgSecondary: '#2E2F28', textPrimary: '#F8F8F2', textSecondary: '#CFCFC2', textMuted: '#75715E' },
  { name: 'synthwave', label: 'Synthwave', primary: '#FF3AC4', hover: '#FF6FD1',
    bgPrimary: '#1A0B2E', bgSecondary: '#21103A', textPrimary: '#F0E7FF', textSecondary: '#B8A3E0', textMuted: '#6D5BA8' },
  { name: 'terminal', label: 'Terminal', primary: '#FFB000', hover: '#FFC73B',
    bgPrimary: '#0C0A00', bgSecondary: '#120F02', textPrimary: '#FFD470', textSecondary: '#CC8800', textMuted: '#5C3E00' },
  { name: 'rosegold', label: 'Rose Gold', primary: '#E8B4B8', hover: '#F4C2C7',
    bgPrimary: '#1A1014', bgSecondary: '#1F151A', textPrimary: '#F5E6E8', textSecondary: '#D9A7AB', textMuted: '#8A6F74' },
  { name: 'midnight', label: 'Meia-noite', primary: '#5E8BFF', hover: '#7FA3FF',
    bgPrimary: '#050816', bgSecondary: '#0A0F24', textPrimary: '#E0E8FF', textSecondary: '#8B9CCE', textMuted: '#4A5580' },
  { name: 'obsidian', label: 'Obsidiana', primary: '#FF6B35', hover: '#FF8A5E',
    bgPrimary: '#0A0A0A', bgSecondary: '#151515', textPrimary: '#E8E8E8', textSecondary: '#A0A0A0', textMuted: '#555555' },
  { name: 'aurora', label: 'Aurora', primary: '#5EEAD4', hover: '#86F1DE',
    bgPrimary: '#051322', bgSecondary: '#081A2E', textPrimary: '#D0F5FC', textSecondary: '#86E7F3', textMuted: '#355E7A' },
  { name: 'sakura', label: 'Sakura', primary: '#F9A8D4', hover: '#FBBAE0',
    bgPrimary: '#14090F', bgSecondary: '#1A0E15', textPrimary: '#FDEAF4', textSecondary: '#E2A4BE', textMuted: '#7A4D65' },
  { name: 'ice', label: 'Gelo', primary: '#93D5F5', hover: '#B5E3F8',
    bgPrimary: '#0A1320', bgSecondary: '#0F1C2D', textPrimary: '#EAF6FD', textSecondary: '#9EC9DE', textMuted: '#4A6B80' },
  { name: 'solarized', label: 'Solarized', primary: '#2AA198', hover: '#3FB5AC',
    bgPrimary: '#002B36', bgSecondary: '#073642', textPrimary: '#FDF6E3', textSecondary: '#93A1A1', textMuted: '#586E75' },
  { name: 'tokyo', label: 'Tokyo Night', primary: '#BB9AF7', hover: '#C9AFFB',
    bgPrimary: '#1A1B26', bgSecondary: '#24283B', textPrimary: '#C0CAF5', textSecondary: '#A9B1D6', textMuted: '#565F89' },
  { name: 'gruvbox', label: 'Gruvbox', primary: '#FE8019', hover: '#FABD2F',
    bgPrimary: '#1D2021', bgSecondary: '#282828', textPrimary: '#EBDBB2', textSecondary: '#BDAE93', textMuted: '#7C6F64' },
];

export const VALID_THEMES: AppTheme[] = THEME_PRESETS.map((t) => t.name);

// === Settings ===

export interface PopoverSettings {
  width: number;
  height: number;
  stealthMode: boolean;
  stealthHoverOpacity: number;
  disguiseMode: boolean;
  disguiseWidget: 'clock';
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
  theme: 'lavender',
  popover: {
    width: 380,
    height: 480,
    stealthMode: false,
    stealthHoverOpacity: 0.4,
    disguiseMode: true,
    disguiseWidget: 'clock',
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
