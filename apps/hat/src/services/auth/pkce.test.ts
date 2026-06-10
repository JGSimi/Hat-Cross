import { describe, expect, it } from 'vitest';
import { base64UrlEncode, randomBase64Url, sha256Base64Url } from './pkce';

describe('pkce', () => {
  it('base64UrlEncode é url-safe e sem padding', () => {
    // btoa([0xfb,0xef,0xbe,0xff]) = "++++/w==" → '+'→'-', '/'→'_', sem '='
    const encoded = base64UrlEncode(new Uint8Array([0xfb, 0xef, 0xbe, 0xff]));
    expect(encoded).not.toMatch(/[+/=]/);
    expect(encoded).toBe('----_w');
  });

  it('randomBase64Url tem entropia e tamanho coerentes', () => {
    const a = randomBase64Url();
    const b = randomBase64Url();
    expect(a).not.toBe(b);
    // 32 bytes → 43 chars base64url sem padding
    expect(a).toHaveLength(43);
    expect(a).not.toMatch(/[+/=]/);
  });

  it('sha256Base64Url bate com vetor conhecido do RFC 7636', async () => {
    // Apêndice B do RFC 7636: verifier → challenge
    const challenge = await sha256Base64Url(
      'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk',
    );
    expect(challenge).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });
});
