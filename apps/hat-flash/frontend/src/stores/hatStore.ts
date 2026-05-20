import { create } from 'zustand';
import { hat, type FlashPayload, type Settings, type StreamChunk } from '../bridge/hat';

const fallbackSettings = {
  autoLaunch: false,
  mode: 'hat',
  language: 'pt-BR',
  systemPrompt: 'Responda em portugues do Brasil, de forma direta e util.',
  temperature: 0.7,
  maxTokens: 4096,
  shortcuts: {
    clipboard: 'CommandOrControl+Shift+X',
    floatingChat: 'CommandOrControl+Shift+C',
    adjustFlashPosition: 'CommandOrControl+Shift+F',
    emergencyQuit: 'CommandOrControl+Shift+Q',
  },
  tokenStats: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
  clipboard: {
    enabled: true,
    copyResponseToClipboard: true,
    maxResponseLength: 4096,
    appendMode: false,
    soundOnComplete: true,
    captureImages: true,
    flash: {
      enabled: false,
      previewLength: 200,
      position: { x: 40, y: 40 },
      timing: { mode: 'fade', fadeInMs: 300, fadeOutMs: 500, holdMs: null },
      appearance: { color: '', opacity: 35, fontSizePx: 14, textShadow: true },
    },
  },
  popover: { width: 380, height: 480, stealthMode: false, stealthHoverOpacity: 0.4, disguiseMode: true },
  notifications: {
    enabled: true,
    showProcessingNotification: true,
    showResponseNotification: true,
    showErrorNotification: true,
    showChatResponseNotification: true,
    showUpdateNotification: true,
    showClipboardEmptyNotification: true,
  },
  chatLimits: { maxContextMessages: 40, maxConversations: 50, maxMessagesPerConversation: 200, autoNewChatOnLimit: true },
  onboardingCompleted: false,
} as Settings;

interface HatStore {
  settings: Settings | null;
  response: string;
  thinking: string;
  streamID: number;
  flashPayload: FlashPayload | null;
  clipboardText: string;
  clipboardImage: string | null;
  setClipboard: (text: string, image: string | null) => void;
  loadSnapshot: (text: string, response: string) => void;
  addStreamChunk: (chunk: StreamChunk) => void;
  resetStream: () => number;
  setFlashPayload: (payload: FlashPayload | null) => void;
  loadSettings: () => Promise<void>;
  saveSettings: (settings: Settings) => Promise<void>;
}

export const useHatStore = create<HatStore>((set, get) => ({
  settings: null,
  response: '',
  thinking: '',
  streamID: 1,
  flashPayload: null,
  clipboardText: '',
  clipboardImage: null,

  setClipboard: (text, image) => set({ clipboardText: text, clipboardImage: image }),
  loadSnapshot: (text, response) => set({ clipboardText: text, clipboardImage: null, response, thinking: '' }),
  addStreamChunk: (chunk) => {
    if (chunk.streamId !== get().streamID) return;
    if (chunk.contentType === 'thinking') {
      set((state) => ({ thinking: state.thinking + chunk.text }));
      return;
    }
    if (chunk.text) {
      set((state) => ({ response: state.response + chunk.text }));
    }
  },
  resetStream: () => {
    const next = get().streamID + 1;
    set({ streamID: next, response: '', thinking: '' });
    return next;
  },
  setFlashPayload: (payload) => set({ flashPayload: payload }),
  loadSettings: async () => {
    try {
      const settings = await hat.settings.get();
      set({ settings });
    } catch {
      set({ settings: fallbackSettings });
    }
  },
  saveSettings: async (settings) => {
    await hat.settings.save(settings).catch(() => undefined);
    await hat.shortcuts.register(settings.shortcuts).catch(() => undefined);
    set({ settings });
  },
}));
