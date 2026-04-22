/**
 * Detects whether clipboard-captured text is a multiple-choice question
 * (expects the answer to be JUST a letter) or an open-ended question
 * (expects a full answer, size determined by the question).
 *
 * This decides the `max_tokens` budget of the upstream call:
 *   - MCQ → ~50 tokens is plenty (a letter + safety margin)
 *   - Open → 2048 tokens so dissertative answers don't come back
 *     mid-sentence — reported 2026-04-23 that a dissertative question
 *     returned "strangely short and incomplete" because the budget
 *     was capped at 400 tokens for all clipboard flows.
 *
 * Heuristic: the text must contain ≥2 lettered-alternative markers
 * (A) / A. / A)) at the start of a line or after whitespace. Two matches
 * is the safety floor so prose that happens to start with "A." doesn't
 * misclassify.
 */

const MCQ_OPTION_MARKER = /(?:^|\s)(?:\([A-Ea-e]\)|[A-Ea-e][.)])\s+\S/g;

export type ClipboardIntent = 'mcq' | 'open';

export function detectClipboardIntent(text: string): ClipboardIntent {
  if (!text) return 'open';
  const matches = text.match(MCQ_OPTION_MARKER);
  return (matches?.length ?? 0) >= 2 ? 'mcq' : 'open';
}

/**
 * Token budget per intent.
 *
 * - MCQ gets a tight cap (64) because any extra output violates the
 *   "letter only" contract.
 * - Open-ended gets the real ceiling of the upstream model (32768 —
 *   matches the top of the user-visible slider in AICard). Reported
 *   2026-04-23 that 2048 still truncated dissertatives; the user
 *   explicitly asked for no artificial cap. Upstream backend is free
 *   to clamp lower if the selected model can't serve this much.
 */
export function maxTokensForIntent(intent: ClipboardIntent): number {
  return intent === 'mcq' ? 64 : 32768;
}
