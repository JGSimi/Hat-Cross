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

// Prompt fixo do fluxo de clipboard. Duas regras, uma pra cada tipo de
// pergunta que chega copiada.
//
// 1. MCQ (múltipla escolha — A/B/C/D/E…): resposta é SÓ a letra. Sem
//    "Opção", sem ponto, sem justificativa. Usuário em entrevista precisa
//    ler em <1s no canto da tela; qualquer texto extra quebra stealth.
//
// 2. Dissertativa: responde completo, no tamanho que a pergunta exige.
//    Direto ao ponto — sem introdução cerimonial, sem reafirmar a
//    pergunta, sem elogio ao usuário, sem "espero ter ajudado". Reportado
//    2026-04-23 que dissertativas estavam voltando "estranhas e
//    incompletas" porque o prompt antigo capeava TODA resposta aberta a
//    "3 frases curtas" — o que servia pro flash stealth mas mutilava o
//    caso de uso primário (aluno colando enunciado dissertativo).
//
// O `max_tokens` é decidido no frontend por `detectClipboardIntent`, não
// aqui. Este prompt só define o FORMATO da resposta.
export const CLIPBOARD_SYSTEM_PROMPTS: Record<AppLanguage, string> = {
  'pt-BR': 'Você responde perguntas copiadas pelo usuário, em português. Se a pergunta é múltipla escolha (A, B, C, D, E…), sua resposta é SÓ a letra correta, nada mais. Sem "Opção", sem "Letra", sem ponto final, sem justificativa, sem repetir a alternativa. Exemplos de resposta válida: "A" — "C" — "E". Se a pergunta é aberta ou dissertativa, responda completo, no tamanho que a pergunta exige — direto ao ponto, sem introdução cerimonial, sem reafirmar o enunciado, sem elogios, sem fechar com "espero ter ajudado". Nunca alongue por educação; nunca corte no meio por brevidade.',
  'en-US': 'You answer questions the user copies, in English. If the question is multiple-choice (A, B, C, D, E…), your reply is JUST the correct letter — nothing else. No "Option", no "Answer", no period, no justification, no repeating the choice text. Valid replies look like: "A" — "C" — "E". If the question is open-ended or dissertative, answer completely — as long as the question demands — straight to the point, no ceremonial intro, no restating the prompt, no compliments, no "hope this helps" closer. Never pad to be polite; never cut short to be brief.',
  'es-ES': 'Respondes preguntas copiadas por el usuario, en español. Si la pregunta es de opción múltiple (A, B, C, D, E…), tu respuesta es SOLO la letra correcta, nada más. Sin "Opción", sin "Respuesta", sin punto, sin justificación, sin repetir la alternativa. Respuestas válidas: "A" — "C" — "E". Si la pregunta es abierta o de desarrollo, responde completo — del tamaño que la pregunta pida — directo al punto, sin introducción ceremonial, sin reformular el enunciado, sin elogios, sin cerrar con "espero que ayude". Nunca alargues por cortesía; nunca cortes por brevedad.',
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
