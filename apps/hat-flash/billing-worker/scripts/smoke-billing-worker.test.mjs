import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSmokeTargets,
  smokeBillingWorker,
} from './smoke-billing-worker.mjs';

function json(body, init = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

test('builds smoke targets from the billing base URL', () => {
  assert.deepEqual(buildSmokeTargets('https://billing.example.test/v1/billing/'), {
    healthz: 'https://billing.example.test/v1/billing/healthz',
    subscription: 'https://billing.example.test/v1/billing/subscription',
  });
});

test('smokes health, CORS, and private auth rejection', async () => {
  const seen = [];
  const fetcher = async (url, init = {}) => {
    seen.push({ url, method: init.method ?? 'GET' });
    if (init.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    }
    if (url.endsWith('/healthz')) {
      return json({
        ok: true,
        checks: {
          billingKV: true,
          stripeSecret: true,
          firebaseProject: true,
          stripePrices: true,
        },
      });
    }
    if (url.endsWith('/subscription')) {
      return json({ error: 'Conecte sua conta Google para continuar.' }, { status: 401 });
    }
    throw new Error(`unexpected url ${url}`);
  };

  await smokeBillingWorker({
    baseURL: 'https://billing.example.test/v1/billing',
    fetcher,
    log: () => undefined,
  });

  assert.deepEqual(seen.map((call) => call.method), ['OPTIONS', 'GET', 'GET']);
});
