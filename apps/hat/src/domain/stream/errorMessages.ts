// Mapeia o código de erro do hat-proxy (formato `error:<code>[:status[:detail]]`,
// ver src-tauri/src/stream.rs + hat-core::error) para uma mensagem amigável
// em pt-BR. O detail cru (JSON do upstream) nunca vai para o usuário.

import { parseErrorCode } from './assembler';

const MESSAGES: Record<string, string> = {
  sessionExpired: 'Sua sessão expirou. Entre de novo para continuar.',
  insufficientCredits: 'Assine um plano para continuar usando o Hat.',
  rateLimited: 'Muitas perguntas em sequência. Espere alguns segundos e tente de novo.',
  serverError: 'O serviço de IA está indisponível no momento. Tente de novo em instantes.',
  unknownError: 'Algo deu errado. Tente de novo.',
};

/**
 * Se `raw` for um código de erro do proxy, devolve a mensagem amigável;
 * caso contrário (texto normal de resposta) devolve null.
 */
export function friendlyErrorMessage(raw: string): string | null {
  const parsed = parseErrorCode(raw);
  if (parsed === null) return null;
  return MESSAGES[parsed.code] ?? MESSAGES['unknownError']!;
}
