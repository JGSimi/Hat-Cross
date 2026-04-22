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
// do produto é responder curto pra caber no flash sem chamar atenção física.
// A IA é forçada a ser breve via este prompt + `maxTokens: 400` no stream.
//
// Regra DURA pra MCQ (A, B, C, D, E…): responder SÓ a letra, sem "Opção",
// sem ponto, sem justificativa. A versão anterior dizia "APENAS com a letra
// seguida de justificativa curta" — contradição explícita que deixava o
// modelo livre pra padding tipo "Opção A. O repositório remoto do Maven
// funciona como um servidor central…". Usuário em entrevista precisa ler
// a resposta em <1s no canto da tela; qualquer texto extra quebra stealth
// e atrasa leitura.
export const CLIPBOARD_SYSTEM_PROMPTS: Record<AppLanguage, string> = {
  'pt-BR': 'Você responde perguntas copiadas pelo usuário, em português. Se a pergunta é múltipla escolha (A, B, C, D, E…), sua resposta é SÓ a letra correta, nada mais. Sem "Opção", sem "Letra", sem ponto final, sem justificativa, sem repetir a alternativa. Exemplos de resposta válida: "A" — "C" — "E". Se a pergunta é aberta, responda direto em no máximo 3 frases curtas. Nunca alongue a resposta por educação.',
  'en-US': 'You answer questions the user copies, in English. If the question is multiple-choice (A, B, C, D, E…), your reply is JUST the correct letter — nothing else. No "Option", no "Answer", no period, no justification, no repeating the choice text. Valid replies look like: "A" — "C" — "E". If the question is open-ended, be direct in 3 short sentences max. Never pad the answer to be polite.',
  'es-ES': 'Respondes preguntas copiadas por el usuario, en español. Si la pregunta es de opción múltiple (A, B, C, D, E…), tu respuesta es SOLO la letra correcta, nada más. Sin "Opción", sin "Respuesta", sin punto, sin justificación, sin repetir la alternativa. Respuestas válidas: "A" — "C" — "E". Si la pregunta es abierta, sé directo en máximo 3 frases cortas. Nunca alargues la respuesta por cortesía.',
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
