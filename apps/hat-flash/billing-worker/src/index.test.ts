import { describe, expect, it } from 'vitest';
import worker, { verifyStripeSignature } from './index';

async function stripeSignature(rawBody: string, secret: string, timestamp: number) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${timestamp}.${rawBody}`),
  );
  const hex = Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `t=${timestamp},v1=${hex}`;
}

describe('billing worker entrypoint', () => {
  it('answers CORS preflight even when required production bindings are not configured yet', async () => {
    const response = await worker.fetch(new Request('https://billing.example.test/v1/billing/checkout', {
      method: 'OPTIONS',
    }), {});

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('rejects stale Stripe webhook signatures', async () => {
    const rawBody = JSON.stringify({ id: 'evt_123' });
    const staleTimestamp = Math.floor(Date.now() / 1000) - 301;
    const header = await stripeSignature(rawBody, 'whsec_test', staleTimestamp);

    await expect(verifyStripeSignature(rawBody, header, 'whsec_test')).rejects.toThrow('expirada');
  });
});
