import { Events } from '@wailsio/runtime';
import {
  AppController,
  AuthController,
  ChatController,
  ClipboardController,
  FlashController,
  SessionController,
  SettingsController,
  ShortcutsController,
  UpdaterController,
} from '../../bindings/github.com/JGSimi/Hat-Cross/apps/hat-flash/internal/controllers';
import type {
  ChatStreamRequest,
  ClipboardPayload,
  FlashPayload,
  OAuthFlowResult,
  Settings,
  ShortcutSettings,
  StreamChunk,
  UpdateStatus,
} from '../../bindings/github.com/JGSimi/Hat-Cross/apps/hat-flash/internal/models';

export type {
  ChatStreamRequest,
  ClipboardPayload,
  FlashPayload,
  OAuthFlowResult,
  Settings,
  ShortcutSettings,
  StreamChunk,
  UpdateStatus,
};

export const hat = {
  auth: {
    runGoogleLoopbackFlow: (
      clientID: string,
      state: string,
      codeChallenge: string,
    ): Promise<OAuthFlowResult> => AuthController.RunGoogleLoopbackFlow(
      clientID,
      state,
      codeChallenge,
    ),
  },
  session: {
    setIDToken: (token: string) => SessionController.SetIDToken(token),
    clear: () => SessionController.Clear(),
  },
  clipboard: {
    process: (): Promise<ClipboardPayload> => ClipboardController.Process(),
    readText: () => ClipboardController.ReadText(),
    readImage: () => ClipboardController.ReadImage(),
    writeText: (text: string) => ClipboardController.WriteText(text),
  },
  chat: {
    stream: (request: ChatStreamRequest) => ChatController.Stream(request),
    cancel: (streamID: number) => ChatController.Cancel(streamID),
  },
  flash: {
    show: (payload: FlashPayload) => FlashController.Show(payload),
    hide: () => FlashController.Hide(),
  },
  shortcuts: {
    register: (settings: ShortcutSettings) => ShortcutsController.Register(settings),
  },
  settings: {
    get: (): Promise<Settings> => SettingsController.Get(),
    save: (settings: Settings) => SettingsController.Save(settings),
  },
  updater: {
    check: (): Promise<UpdateStatus> => UpdaterController.Check(),
  },
  app: {
    quit: () => AppController.Quit(),
    setAutostart: (enabled: boolean) => AppController.SetAutostart(enabled),
    isAutostartEnabled: () => AppController.IsAutostartEnabled(),
  },
};

export function onStreamChunk(cb: (chunk: StreamChunk) => void) {
  return Events.On('stream:chunk', (event) => cb(event.data));
}
