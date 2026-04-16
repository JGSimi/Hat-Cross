import { startStream, startHatStream } from '.';
import type { ConversationTurn, StreamChunk } from '../../types';
import { PROVIDER_DEFAULTS } from '../../types';
import { useAuthStore } from '../../stores/authStore';
import { useCreditsStore } from '../../stores/creditsStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { getIdToken } from '../auth/firebase';

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

// Decides whether to route the request through the Hat proxy Worker
// (credits-backed, requires Firebase sign-in) or the direct BYOK path
// (user-supplied API key + direct provider call). The caller doesn't need
// to know which leg is active — it gets the same onChunk/onDone events.
//
// Returns a cancel function, or null when the call couldn't even be kicked
// off (missing API key on BYOK, expired token on Hat). In the null case the
// error message has already been surfaced via setError, so the caller just
// aborts the streaming UI transition.
export async function dispatchStream(
  options: DispatchOptions,
  setError: (message: string) => void,
): Promise<(() => void) | null> {
  const { user } = useAuthStore.getState();
  const { settings, providerConfigs } = useSettingsStore.getState();

  if (user) {
    const idToken = await getIdToken();
    if (!idToken) {
      setError('Sessao expirada. Faca login de novo em Configuracoes > Conta.');
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
    });
  }

  // BYOK path — same branch as before the credits system landed.
  const provider = settings.cloudProvider;
  const cfg = providerConfigs[provider];
  const endpoint =
    cfg?.endpoint || PROVIDER_DEFAULTS[provider]?.defaultEndpoint || '';
  const model = cfg?.model || '';
  const apiKey = cfg?.apiKey || '';
  if (!apiKey.trim()) {
    setError(
      'Chave de API nao configurada. Entre no Hat (gratis) ou va em Configuracoes > Modelos & IA.',
    );
    return null;
  }

  const thinkingEnabled = cfg?.thinkingEnabled ?? false;
  const thinkingBudget = cfg?.thinkingBudget ?? 10000;
  // Anthropic requires temperature=1 when extended thinking is on; other
  // providers accept whatever the user configured.
  const effectiveTemp =
    provider === 'anthropic' && thinkingEnabled ? 1.0 : options.temperature;

  return startStream({
    messages: options.messages,
    systemPrompt: options.systemPrompt,
    provider,
    endpoint,
    model,
    temperature: effectiveTemp,
    maxTokens: options.maxTokens,
    images: options.images,
    thinkingEnabled,
    thinkingBudget,
    onChunk: options.onChunk,
    onError: options.onError,
    onDone: options.onDone,
  });
}
