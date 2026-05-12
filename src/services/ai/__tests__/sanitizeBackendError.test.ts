import { describe, it, expect, beforeAll } from 'vitest';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ptErrors from '../../../i18n/locales/pt-BR/errors.json';
import { sanitizeBackendError } from '../index';

beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: 'pt-BR',
    fallbackLng: 'pt-BR',
    defaultNS: 'errors',
    resources: { 'pt-BR': { errors: ptErrors } },
    interpolation: { escapeValue: false },
    returnNull: false,
    react: { useSuspense: false },
  });
});

/**
 * Reported 2026-04-23: the failure path was leaking
 *   `error:serverError:500:Gemini 503: { ... }`
 * into a chat bubble. The sanitizer must NEVER return the raw wire
 * string or anything containing provider names / HTTP codes / JSON
 * shapes. These tests codify the safety contract.
 */
describe('sanitizeBackendError — safety contract', () => {
  it('maps the reported 2026-04-23 raw string to localized provider-5xx title', () => {
    const raw =
      'error:serverError:500:Gemini 503: { "error": { "code": 503, "message": "high demand" }}';
    const safe = sanitizeBackendError(raw);
    expect(safe).toBe('Provedor fora do ar');
    expect(safe).not.toContain('Gemini');
    expect(safe).not.toContain('503');
    expect(safe).not.toContain('error:');
    expect(safe).not.toContain('{');
  });

  it('never leaks "Gemini" regardless of surrounding payload', () => {
    const raw = 'error:serverError:500:Gemini said goodbye';
    expect(sanitizeBackendError(raw)).not.toContain('Gemini');
  });

  it('never leaks Gemini model migration details', () => {
    const oldModel = `${'gemini-3.1-flash-lite'}-preview`;
    const raw =
      `error:serverError:400:${oldModel} is deprecated; use gemini-3.1-flash-lite`;
    const safe = sanitizeBackendError(raw);
    expect(safe).toBe('Provedor fora do ar');
    expect(safe).not.toContain(oldModel);
    expect(safe).not.toContain('gemini-3.1-flash-lite');
    expect(safe).not.toContain('deprecated');
  });

  it('maps rateLimited to provider-429 title', () => {
    expect(sanitizeBackendError('error:rateLimited')).toBe(
      'Limite do provedor estourou',
    );
  });

  it('maps sessionExpired to firebase-auth-invalid-credential title', () => {
    expect(sanitizeBackendError('error:sessionExpired')).toBe(
      'Credencial inválida',
    );
  });

  it('maps insufficientCredits to credits-insufficient title', () => {
    expect(sanitizeBackendError('error:insufficientCredits')).toBe(
      'Créditos no zero',
    );
  });

  it('returns a generic title for an unknown-error wire string', () => {
    const safe = sanitizeBackendError('error:unknownError:418:teapot');
    expect(safe).toBe('Erro inesperado');
    expect(safe).not.toContain('teapot');
    expect(safe).not.toContain('418');
  });

  it('handles plain string throws without leaking them', () => {
    const safe = sanitizeBackendError('something weird on the wire');
    expect(safe).toBe('Erro inesperado');
    expect(safe).not.toContain('something weird');
  });

  it('handles Error instances whose message is a wire string', () => {
    const safe = sanitizeBackendError(new Error('error:rateLimited'));
    expect(safe).toBe('Limite do provedor estourou');
  });

  it('handles null / undefined without crashing', () => {
    expect(sanitizeBackendError(null)).toBe('Erro inesperado');
    expect(sanitizeBackendError(undefined)).toBe('Erro inesperado');
  });

  it('handles empty string', () => {
    expect(sanitizeBackendError('')).toBe('Erro inesperado');
  });
});
