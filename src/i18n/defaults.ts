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

// Prompt fixo do fluxo de clipboard. Não é editável pelo usuário — o contrato
// do produto é responder curto (múltipla escolha ou dissertativa de ≤3 frases).
// A IA é forçada a ser breve via este prompt + `maxTokens: 400` no stream.
export const CLIPBOARD_SYSTEM_PROMPTS: Record<AppLanguage, string> = {
  'pt-BR': 'Você responde perguntas copiadas pelo usuário. Se for múltipla escolha (A, B, C, D…), responda APENAS com a letra correta seguida de justificativa curta (1–2 frases). Se for aberta, seja direto e conciso (máximo 3 frases). Nunca alongue a resposta.',
  'en-US': 'You answer questions the user copies. If multiple-choice (A, B, C, D…), reply ONLY with the correct letter followed by a brief justification (1–2 sentences). If open-ended, be direct and concise (max 3 sentences). Never pad the answer.',
  'es-ES': 'Respondes preguntas copiadas por el usuario. Si es opción múltiple (A, B, C, D…), responde SOLO con la letra correcta seguida de una justificación breve (1–2 frases). Si es abierta, sé directo y conciso (máximo 3 frases). Nunca alargues la respuesta.',
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
