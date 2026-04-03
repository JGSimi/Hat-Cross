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

// === AI Models ===

export interface ConversationTurn {
  role: 'user' | 'assistant' | 'system';
  textContent: string;
  images?: string[]; // base64
}

export interface StreamChunk {
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

export type AppTheme = 'indigo' | 'blue' | 'purple' | 'pink' | 'red' | 'orange' | 'green' | 'teal' | 'mono';

export interface ThemePreset {
  name: AppTheme;
  label: string;
  primary: string;
  hover: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  { name: 'indigo', label: 'Indigo', primary: '#6366F1', hover: '#818CF8' },
  { name: 'blue', label: 'Azul', primary: '#3B82F6', hover: '#60A5FA' },
  { name: 'purple', label: 'Roxo', primary: '#935EEE', hover: '#A78BFA' },
  { name: 'pink', label: 'Rosa', primary: '#EC4899', hover: '#F472B6' },
  { name: 'red', label: 'Vermelho', primary: '#EF4444', hover: '#F87171' },
  { name: 'orange', label: 'Laranja', primary: '#F58522', hover: '#FB923C' },
  { name: 'green', label: 'Verde', primary: '#22C55E', hover: '#4ADE80' },
  { name: 'teal', label: 'Azul Piscina', primary: '#14B8A6', hover: '#2DD4BF' },
  { name: 'mono', label: 'Mono', primary: '#99999F', hover: '#B0B0B8' },
];

// === Settings ===

export interface PopoverSettings {
  width: number;
  height: number;
  opacity: number;
  vibrancy: boolean;
  stealthMode: boolean;
  stealthHoverOpacity: number;
}

export interface ShortcutSettings {
  clipboard: string;
  screenCapture: string;
  quickInput: string;
}

export interface ClipboardSettings {
  enabled: boolean;
  copyResponseToClipboard: boolean;
  showNotificationWithResponse: boolean;
  customPrompt: string;
  useCustomPrompt: boolean;
  maxResponseLength: number;
  appendMode: boolean; // append response below original text
  soundOnComplete: boolean;
}

export interface AppSettings {
  autoLaunch: boolean;
  soundEnabled: boolean;
  notificationsEnabled: boolean;
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
}

export const DEFAULT_SETTINGS: AppSettings = {
  autoLaunch: false,
  soundEnabled: true,
  notificationsEnabled: true,
  theme: 'indigo',
  popover: {
    width: 380,
    height: 480,
    opacity: 1.0,
    vibrancy: false,
    stealthMode: false,
    stealthHoverOpacity: 0.4,
  },
  inferenceMode: 'api',
  cloudProvider: 'google',
  localModel: 'gemma3:4b',
  systemPrompt: 'Você é um assistente de IA útil e conciso. Responda em português brasileiro.',
  temperature: 0.7,
  maxTokens: 4096,
  shortcuts: {
    clipboard: 'CmdOrCtrl+Shift+X',
    screenCapture: 'CmdOrCtrl+Shift+Z',
    quickInput: 'CmdOrCtrl+Shift+Space',
  },
  tokenStats: {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  },
  clipboard: {
    enabled: true,
    copyResponseToClipboard: true,
    showNotificationWithResponse: true,
    customPrompt: '',
    useCustomPrompt: false,
    maxResponseLength: 4096,
    appendMode: false,
    soundOnComplete: true,
  },
};
