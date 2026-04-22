import { describe, it, expect } from 'vitest';
import { CLIPBOARD_SYSTEM_PROMPTS } from '../defaults';

/**
 * Regression contract — covers TWO incidents:
 *
 *   2026-04-22: MCQ questions came back padded ("Opção A. O
 *   repositório…") because the prompt said "APENAS a letra seguida
 *   de justificativa curta" — a self-contradiction.
 *
 *   2026-04-23: dissertative questions came back "strangely short and
 *   incomplete" because the prompt capped ALL open-ended replies at
 *   "3 short sentences max" — that served the flash-stealth use-case
 *   but mutilated the primary use-case (student pasting a
 *   dissertative prompt).
 *
 * Contract now:
 *   - MCQ still letter-only (assertions 1–3)
 *   - Open-ended has NO artificial sentence cap (assertion 4)
 *   - Prompt actively bans ceremonial padding for open-ended
 *     (assertion 5) so tokens are spent on the answer, not fluff
 */
describe('CLIPBOARD_SYSTEM_PROMPTS — MCQ letter-only contract', () => {
  it.each(['pt-BR', 'en-US', 'es-ES'] as const)(
    '[%s] never asks for a justification next to the MCQ letter',
    (lang) => {
      const prompt = CLIPBOARD_SYSTEM_PROMPTS[lang].toLowerCase();
      // The original buggy prompt had "letter … followed by a
      // justification". Ban that exact coupling — the prompt is free
      // to SAY the word justificativa when forbidding it ("sem
      // justificativa"), but never when requesting it.
      expect(prompt).not.toMatch(/seguid[ao]\s+de\s+justificativ/);
      expect(prompt).not.toMatch(/followed\s+by\s+a\s+brief\s+justif/);
      expect(prompt).not.toMatch(/seguida\s+de\s+una\s+justificaci/);
    },
  );

  it.each(['pt-BR', 'en-US', 'es-ES'] as const)(
    '[%s] forbids the "Option X" prefix explicitly',
    (lang) => {
      const prompt = CLIPBOARD_SYSTEM_PROMPTS[lang];
      // We *require* the prompt to actively ban "Opção" / "Option" /
      // "Opción", because the model otherwise defaults to it.
      const mentionsBan =
        /sem\s+"?opção"?/i.test(prompt) ||
        /no\s+"?option"?/i.test(prompt) ||
        /sin\s+"?opción"?/i.test(prompt);
      expect(mentionsBan).toBe(true);
    },
  );

  it.each(['pt-BR', 'en-US', 'es-ES'] as const)(
    '[%s] shows at least one letter-only example so the model anchors on it',
    (lang) => {
      const prompt = CLIPBOARD_SYSTEM_PROMPTS[lang];
      // Expect at least one "A" / "B" / "C" / "D" / "E" in quotes as a
      // concrete example — anchoring is what actually makes the model
      // obey more than prose does.
      expect(prompt).toMatch(/"[A-E]"/);
    },
  );

  it.each(['pt-BR', 'en-US', 'es-ES'] as const)(
    '[%s] does NOT impose an artificial sentence cap on open-ended',
    (lang) => {
      const prompt = CLIPBOARD_SYSTEM_PROMPTS[lang];
      // The 2026-04-23 incident was caused by literally capping all
      // open-ended replies at "3 frases"/"3 sentences". Dissertative
      // questions need full answers. Ban that exact phrasing for the
      // open-ended directive — the prompt is free to mention numbers
      // elsewhere (e.g. in the MCQ letter example "A, B, C, D, E…"),
      // but it must not couple a small integer with "frases"/"sentences"/
      // "frases" (es).
      expect(prompt).not.toMatch(/[1-5]\s+\w*\s*(frases|sentences)/);
    },
  );

  it.each(['pt-BR', 'en-US', 'es-ES'] as const)(
    '[%s] bans ceremonial padding on open-ended answers',
    (lang) => {
      const prompt = CLIPBOARD_SYSTEM_PROMPTS[lang];
      // Force the model to spend tokens on substance. At least one of
      // the padding patterns must be actively forbidden.
      const bansPadding =
        /sem introdução/i.test(prompt) ||
        /no ceremonial intro/i.test(prompt) ||
        /sin introducción/i.test(prompt);
      expect(bansPadding).toBe(true);
    },
  );
});
