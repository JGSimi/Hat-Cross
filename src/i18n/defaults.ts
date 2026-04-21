// Constantes e helpers relacionados a idioma. Mantidos separados do
// i18next runtime pra poder serem importados sem inicializar nada.

export type AppLanguage = 'pt-BR' | 'en-US' | 'es-ES';

export const SUPPORTED_LANGUAGES: readonly AppLanguage[] = ['pt-BR', 'en-US', 'es-ES'];

export const LANGUAGE_LABELS: Record<AppLanguage, { native: string; flag: string; short: string }> = {
  'pt-BR': { native: 'Português',  flag: '🇧🇷', short: 'PT' },
  'en-US': { native: 'English',    flag: '🇺🇸', short: 'EN' },
  'es-ES': { native: 'Español',    flag: '🇪🇸', short: 'ES' },
};

// Prompts default por idioma. Se o usuário não editou o prompt manualmente
// (ainda está num desses valores), trocamos automaticamente ao mudar de
// idioma. Se editou, deixamos como está e avisamos.
export const DEFAULT_SYSTEM_PROMPTS: Record<AppLanguage, string> = {
  'pt-BR': 'Você é um assistente de IA útil e conciso. Responda em português brasileiro.',
  'en-US': 'You are a helpful and concise AI assistant. Respond in English.',
  'es-ES': 'Eres un asistente de IA útil y conciso. Responde en español.',
};

/** Retorna o idioma correspondente se o prompt for um default conhecido, senão null. */
export function matchesDefaultPrompt(prompt: string): AppLanguage | null {
  for (const [lang, p] of Object.entries(DEFAULT_SYSTEM_PROMPTS)) {
    if (p === prompt) return lang as AppLanguage;
  }
  return null;
}

/**
 * Detecta o idioma inicial para novos usuários. Primeiro tenta navigator.language,
 * mapeia pro idioma suportado mais próximo, fallback pra pt-BR (mantém comportamento
 * atual — usuários antigos não perdem nada).
 */
export function detectInitialLanguage(): AppLanguage {
  if (typeof navigator === 'undefined') return 'pt-BR';
  const raw = (navigator.language || 'pt-BR').toLowerCase();
  if (raw.startsWith('pt')) return 'pt-BR';
  if (raw.startsWith('es')) return 'es-ES';
  if (raw.startsWith('en')) return 'en-US';
  return 'pt-BR';
}

/** BCP 47 tag pro `toLocaleString` / `Intl.*`. */
export function localeTag(lang: AppLanguage): string {
  return lang;
}
