import { describe, it, expect } from 'vitest';
import { CLIPBOARD_SYSTEM_PROMPTS } from '../defaults';

/**
 * Regression contract — user reported 2026-04-22 that MCQ questions
 * processed via clipboard were coming back as
 *    "Opção A. O repositório remoto do Maven funciona como ..."
 * instead of just "A". Root cause: the prompt said literally
 * "APENAS com a letra correta seguida de justificativa curta" — a
 * self-contradiction that gave the model license to pad.
 *
 * These assertions fail loudly if the contradiction is reintroduced
 * or the word "justificativa" / "justification" / "justificación"
 * reappears in the MCQ directive.
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
    '[%s] caps open-ended answers at 3 sentences',
    (lang) => {
      const prompt = CLIPBOARD_SYSTEM_PROMPTS[lang];
      // "3 frases" / "3 sentences" / "3 frases" (es) — allow an optional
      // adjective (short / curtas / cortas) between the number and the
      // unit so the wording can breathe.
      expect(prompt).toMatch(/3\s+\w*\s*(frases|sentences)/);
    },
  );
});
