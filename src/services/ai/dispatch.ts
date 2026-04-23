import { startHatStream } from '.';
import type { ConversationTurn, StreamChunk } from '../../types';
import { useAuthStore } from '../../stores/authStore';
import { useCreditsStore } from '../../stores/creditsStore';
import { useToastStore } from '../../stores/toastStore';
import { getIdToken } from '../auth/firebase';
import i18n from '../../i18n';

export interface DispatchOptions {
  messages: ConversationTurn[];
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  images: string[];
  onChunk: (chunk: StreamChunk) => void;
  onError: (error: string) => void;
  onDone: () => void;
}

const RETRY_MAX_ATTEMPTS = 3;

// Central entry point for every chat request. Since the BYOK path is gone,
// dispatchStream just gates on "is the user signed in?": if yes, call the
// Hat proxy Worker with the selected mode + Firebase ID token; if no, emit
// a setup-required error and abort. Returns a cancel fn or null when the
// call couldn't be kicked off.
export async function dispatchStream(
  options: DispatchOptions,
  setError: (message: string) => void,
): Promise<(() => void) | null> {
  const { user } = useAuthStore.getState();

  if (!user) {
    setError('Entre no Hat com sua conta Google para usar a IA.');
    return null;
  }

  const idToken = await getIdToken();
  if (!idToken) {
    setError('Sessão expirada. Faça login de novo em Configurações > Conta.');
    return null;
  }

  const mode = useCreditsStore.getState().selectedMode;
  return startHatStream({
    messages: options.messages,
    systemPrompt: options.systemPrompt,
    mode,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    images: options.images,
    idToken,
    onChunk: options.onChunk,
    onError: options.onError,
    onDone: options.onDone,
    onRetry: (_kind, attempt) => {
      // Surface the retry so the user knows Hat isn't frozen — just
      // waiting out a transient upstream hiccup. Toast is intentionally
      // light (info, 2.5s) because successful retries should feel
      // invisible in the happy path.
      useToastStore.getState().showToast(
        i18n.t('errors:retrying', {
          attempt,
          max: RETRY_MAX_ATTEMPTS,
          defaultValue: 'Tentando de novo…',
        }),
        'info',
        { duration: 2500 },
      );
    },
  });
}
