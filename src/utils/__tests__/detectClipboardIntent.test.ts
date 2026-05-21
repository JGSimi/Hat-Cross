import { describe, it, expect } from 'vitest';
import {
  detectClipboardIntent,
  maxTokensForIntent,
} from '../detectClipboardIntent';

describe('detectClipboardIntent', () => {
  it('classifies empty input as open', () => {
    expect(detectClipboardIntent('')).toBe('open');
  });

  it('classifies plain dissertative question as open', () => {
    expect(
      detectClipboardIntent(
        'Explique o que é um repositório remoto no Maven e pra que ele serve.',
      ),
    ).toBe('open');
  });

  it('classifies prose that happens to start with "A." as open', () => {
    // Single match — the floor is 2 to avoid this kind of false positive.
    expect(
      detectClipboardIntent(
        'A. inteligência artificial é um campo amplo de estudo que se ocupa de máquinas.',
      ),
    ).toBe('open');
  });

  it('detects A) B) C) style MCQ', () => {
    expect(
      detectClipboardIntent(
        'Qual é a capital do Brasil?\nA) Rio de Janeiro\nB) São Paulo\nC) Brasília\nD) Salvador',
      ),
    ).toBe('mcq');
  });

  it('detects A. B. C. style MCQ', () => {
    expect(
      detectClipboardIntent(
        'Qual é a capital do Brasil?\nA. Rio de Janeiro\nB. São Paulo\nC. Brasília',
      ),
    ).toBe('mcq');
  });

  it('detects (A) (B) (C) style MCQ', () => {
    expect(
      detectClipboardIntent(
        'Qual é a capital do Brasil? (a) Rio (b) São Paulo (c) Brasília',
      ),
    ).toBe('mcq');
  });

  it('detects lowercase MCQ markers', () => {
    expect(
      detectClipboardIntent(
        'Qual?\na) opção 1\nb) opção 2\nc) opção 3',
      ),
    ).toBe('mcq');
  });

  it('treats a single lettered bullet as open', () => {
    // 1 match only — insufficient signal.
    expect(
      detectClipboardIntent('Resumo:\nA) item solitário.'),
    ).toBe('open');
  });
});

describe('maxTokensForIntent', () => {
  it('returns a tight cap for MCQ', () => {
    expect(maxTokensForIntent('mcq')).toBeLessThan(100);
  });

  it('returns the product ceiling for open-ended (no artificial cap)', () => {
    // 2026-04-23 regression: user explicitly asked not to cap
    // dissertative answers. 2048 still truncated real prompts. The
    // ceiling must match or exceed the clipboard budget top
    // so the clipboard flow can't be the weakest link anymore.
    expect(maxTokensForIntent('open')).toBeGreaterThanOrEqual(32768);
  });
});
