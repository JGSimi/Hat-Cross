// === Chat Models ===

export interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: number;
  source: 'chat' | 'screenAnalysis' | 'clipboard';
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
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

// === Providers ===

export type InferenceMode = 'local' | 'api';

export type CloudProvider =
  | 'google'
  | 'openai'
  | 'anthropic'
  | 'inception'
  | 'openrouter'
  | 'custom';

export interface ProviderConfig {
  name: CloudProvider;
  displayName: string;
  defaultEndpoint: string;
  modelsEndpoint: string | null;
  apiKey: string;
  endpoint: string;
  model: string;
}

export const PROVIDER_DEFAULTS: Record<CloudProvider, Omit<ProviderConfig, 'apiKey' | 'model'>> = {
  google: {
    name: 'google',
    displayName: 'Google Gemini',
    defaultEndpoint: 'https://generativelanguage.googleapis.com/v1beta/openai',
    modelsEndpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/models',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai',
  },
  openai: {
    name: 'openai',
    displayName: 'OpenAI',
    defaultEndpoint: 'https://api.openai.com/v1',
    modelsEndpoint: 'https://api.openai.com/v1/models',
    endpoint: 'https://api.openai.com/v1',
  },
  anthropic: {
    name: 'anthropic',
    displayName: 'Anthropic Claude',
    defaultEndpoint: 'https://api.anthropic.com/v1',
    modelsEndpoint: null,
    endpoint: 'https://api.anthropic.com/v1',
  },
  inception: {
    name: 'inception',
    displayName: 'Inception Mercury',
    defaultEndpoint: 'https://api.inceptionlabs.ai/v1',
    modelsEndpoint: 'https://api.inceptionlabs.ai/v1/models',
    endpoint: 'https://api.inceptionlabs.ai/v1',
  },
  openrouter: {
    name: 'openrouter',
    displayName: 'OpenRouter',
    defaultEndpoint: 'https://openrouter.ai/api/v1',
    modelsEndpoint: 'https://openrouter.ai/api/v1/models',
    endpoint: 'https://openrouter.ai/api/v1',
  },
  custom: {
    name: 'custom',
    displayName: 'Custom',
    defaultEndpoint: '',
    modelsEndpoint: null,
    endpoint: '',
  },
};

// === Theme ===

export type AppTheme =
  | 'indigo' | 'blue' | 'purple' | 'pink' | 'red' | 'orange' | 'green' | 'teal' | 'mono'
  | 'noir' | 'cappuccino' | 'cyberpunk' | 'minimal' | 'ocean' | 'sunset' | 'forest' | 'lavender' | 'cherry';

export interface ThemePreset {
  name: AppTheme;
  label: string;
  primary: string;
  hover: string;
  category: 'accent' | 'full';
  // Full themes override backgrounds and text
  bgPrimary?: string;
  bgSecondary?: string;
  textPrimary?: string;
  textSecondary?: string;
  textMuted?: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  // --- Accent themes (only change accent color) ---
  { name: 'indigo', label: 'Indigo', primary: '#6366F1', hover: '#818CF8', category: 'accent' },
  { name: 'blue', label: 'Azul', primary: '#3B82F6', hover: '#60A5FA', category: 'accent' },
  { name: 'purple', label: 'Roxo', primary: '#935EEE', hover: '#A78BFA', category: 'accent' },
  { name: 'pink', label: 'Rosa', primary: '#EC4899', hover: '#F472B6', category: 'accent' },
  { name: 'red', label: 'Vermelho', primary: '#EF4444', hover: '#F87171', category: 'accent' },
  { name: 'orange', label: 'Laranja', primary: '#F58522', hover: '#FB923C', category: 'accent' },
  { name: 'green', label: 'Verde', primary: '#22C55E', hover: '#4ADE80', category: 'accent' },
  { name: 'teal', label: 'Azul Piscina', primary: '#14B8A6', hover: '#2DD4BF', category: 'accent' },
  { name: 'mono', label: 'Mono', primary: '#99999F', hover: '#B0B0B8', category: 'accent' },
  // --- Full themes (override everything) ---
  { name: 'noir', label: 'Noir', primary: '#FFFFFF', hover: '#E0E0E0', category: 'full',
    bgPrimary: '#000000', bgSecondary: '#080808', textPrimary: '#FFFFFF', textSecondary: '#AAAAAA', textMuted: '#666666' },
  { name: 'cappuccino', label: 'Cappuccino', primary: '#C4956A', hover: '#D4A574', category: 'full',
    bgPrimary: '#1C1410', bgSecondary: '#211914', textPrimary: '#E8DDD4', textSecondary: '#C4B5A5', textMuted: '#8A7A6A' },
  { name: 'cyberpunk', label: 'Cyberpunk', primary: '#FF2D6A', hover: '#FF5A8A', category: 'full',
    bgPrimary: '#0A0A12', bgSecondary: '#0E0E1A', textPrimary: '#E0F0FF', textSecondary: '#80C8FF', textMuted: '#4A6A8A' },
  { name: 'minimal', label: 'Minimal', primary: '#666666', hover: '#888888', category: 'full',
    bgPrimary: '#111111', bgSecondary: '#161616', textPrimary: '#D4D4D4', textSecondary: '#999999', textMuted: '#555555' },
  { name: 'ocean', label: 'Oceano', primary: '#0EA5E9', hover: '#38BDF8', category: 'full',
    bgPrimary: '#0B1622', bgSecondary: '#0F1C2A', textPrimary: '#E0F2FE', textSecondary: '#7DD3FC', textMuted: '#3A7AA8' },
  { name: 'sunset', label: 'Pôr do Sol', primary: '#F97316', hover: '#FB923C', category: 'full',
    bgPrimary: '#1A0E08', bgSecondary: '#1E1210', textPrimary: '#FEF3C7', textSecondary: '#FDBA74', textMuted: '#9A6A3A' },
  { name: 'forest', label: 'Floresta', primary: '#16A34A', hover: '#22C55E', category: 'full',
    bgPrimary: '#0A140C', bgSecondary: '#0E1A10', textPrimary: '#DCFCE7', textSecondary: '#86EFAC', textMuted: '#3A7A4A' },
  { name: 'lavender', label: 'Lavanda', primary: '#A78BFA', hover: '#C4B5FD', category: 'full',
    bgPrimary: '#110E18', bgSecondary: '#16121E', textPrimary: '#EDE9FE', textSecondary: '#C4B5FD', textMuted: '#6A5A8A' },
  { name: 'cherry', label: 'Cereja', primary: '#E11D48', hover: '#FB7185', category: 'full',
    bgPrimary: '#180A10', bgSecondary: '#1E0E14', textPrimary: '#FFE4E6', textSecondary: '#FDA4AF', textMuted: '#8A3A4A' },
];

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

export type FontSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type BackgroundStyle = 'default' | 'solid' | 'darker' | 'lighter' | 'custom';

export interface AppearanceSettings {
  fontSize: FontSize;
  fontScale: number;             // 0.8 to 1.4, multiplier
  backgroundStyle: BackgroundStyle;
  customBackground: string;      // hex color for custom bg
  messageBubbleOpacity: number;  // 0.5 to 1.0
  sidebarWidth: number;          // 180 to 320
  uiOpacity: number;             // 0.7 to 1.0 global opacity
}

export interface PerformanceSettings {
  reducedMotion: boolean;        // disable all framer-motion animations
  disableBlur: boolean;          // disable backdrop-filter: blur
  disableMouseBackground: boolean; // disable mouse-reactive blobs
  disableAnimatedGradients: boolean; // disable ambient drift + gradient shift
  disableSplashScreen: boolean;  // skip splash screen on launch
  disableStaggerAnimations: boolean; // disable staggered list animations
}

export interface AppSettings {
  autoLaunch: boolean;
  soundEnabled: boolean;
  theme: AppTheme;
  popover: PopoverSettings;
  inferenceMode: InferenceMode;
  cloudProvider: CloudProvider;
  localModel: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  shortcuts: ShortcutSettings;
  tokenStats: TokenUsage;
  clipboard: ClipboardSettings;
  notifications: NotificationSettings;
  chatLimits: ChatLimits;
  appearance: AppearanceSettings;
  performance: PerformanceSettings;
}

export const DEFAULT_SETTINGS: AppSettings = {
  autoLaunch: false,
  soundEnabled: true,
  theme: 'indigo',
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
  inferenceMode: 'api',
  cloudProvider: 'google',
  localModel: 'gemma3:4b',
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
  appearance: {
    fontSize: 'md',
    fontScale: 1.0,
    backgroundStyle: 'default',
    customBackground: '#0C0C0E',
    messageBubbleOpacity: 1.0,
    sidebarWidth: 220,
    uiOpacity: 1.0,
  },
  performance: {
    reducedMotion: false,
    disableBlur: false,
    disableMouseBackground: false,
    disableAnimatedGradients: false,
    disableSplashScreen: false,
    disableStaggerAnimations: false,
  },
};
