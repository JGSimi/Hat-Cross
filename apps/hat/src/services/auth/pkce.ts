// Primitivas PKCE (RFC 7636) — puras e testáveis. Usadas pelo fluxo OAuth
// de desktop: o verifier fica no cliente, o challenge (S256) vai na URL.

/** Codifica bytes em base64url sem padding. */
export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

/** String aleatória base64url (default 32 bytes = 256 bits de entropia). */
export function randomBase64Url(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return base64UrlEncode(buf);
}

/** Challenge S256: BASE64URL(SHA-256(verifier)). */
export async function sha256Base64Url(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}
