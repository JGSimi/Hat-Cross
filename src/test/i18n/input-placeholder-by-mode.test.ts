import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const inputSrc = readFileSync(
  join(here, '..', '..', 'components/Chat/InputArea.tsx'),
  'utf-8',
);

function chat(locale: string): Record<string, unknown> {
  return JSON.parse(
    readFileSync(
      join(here, '..', '..', 'i18n/locales', locale, 'chat.json'),
      'utf-8',
    ),
  );
}

/**
 * Regression contract for N1 (heuristic review) — the chat input
 * placeholder must vary by selected mode so Hat vs Hat Pro
 * communicate their shape at the point of entry.
 */
describe('i18n: chat.input.placeholderByMode (N1)', () => {
  it('InputArea resolves the placeholder via placeholderByMode.{selectedMode}', () => {
    expect(inputSrc).toMatch(
      /input\.placeholderByMode\.\$\{selectedMode\}/,
    );
  });

  it('InputArea falls back to input.placeholder when the mode key is missing', () => {
    expect(inputSrc).toMatch(/defaultValue:\s*t\(['"]input\.placeholder['"]\)/);
  });

  it.each(['pt-BR', 'en-US', 'es-ES'])(
    '[%s] defines placeholderByMode for hat + hat-pro',
    (locale) => {
      const bundle = chat(locale) as {
        input: { placeholderByMode: Record<string, string> };
      };
      expect(bundle.input.placeholderByMode.hat).toBeTruthy();
      expect(bundle.input.placeholderByMode['hat-pro']).toBeTruthy();
    },
  );

  it('pt-BR copy respects the voice guide (no emoji, no exclamation)', () => {
    const bundle = chat('pt-BR') as {
      input: { placeholderByMode: { hat: string; 'hat-pro': string } };
    };
    const all = [
      bundle.input.placeholderByMode.hat,
      bundle.input.placeholderByMode['hat-pro'],
    ].join(' ');
    expect(all).not.toMatch(/[!🎩✨]/);
  });
});
