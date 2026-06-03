import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HAT_FLASH_PLANS,
  provisionStripeCatalog,
  stripeForm,
} from './provision-stripe-catalog.mjs';

function json(body) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('defines Hat Flash monthly BRL plans', () => {
  assert.deepEqual(HAT_FLASH_PLANS.map((plan) => ({
    key: plan.key,
    name: plan.name,
    amountBRL: plan.amountBRL,
    envName: plan.envName,
  })), [
    { key: 'go', name: 'Hat Flash Go', amountBRL: 20, envName: 'STRIPE_PRICE_GO' },
    { key: 'pro', name: 'Hat Flash Pro', amountBRL: 50, envName: 'STRIPE_PRICE_PRO' },
    { key: 'ultra', name: 'Hat Flash Ultra', amountBRL: 99, envName: 'STRIPE_PRICE_ULTRA' },
  ]);
});

test('builds Stripe form bodies without losing nested keys', () => {
  const body = stripeForm({
    name: 'Hat Flash Go',
    'metadata[plan]': 'go',
    unit_amount: 2000,
  });

  assert.equal(body.get('name'), 'Hat Flash Go');
  assert.equal(body.get('metadata[plan]'), 'go');
  assert.equal(body.get('unit_amount'), '2000');
});

test('creates products and monthly recurring prices when they do not exist', async () => {
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({ url, body: new URLSearchParams(String(init?.body ?? '')) });
    if (url.includes('/v1/prices/search')) return json({ data: [] });
    if (url.endsWith('/v1/products')) return json({ id: `prod_${calls.length}` });
    if (url.endsWith('/v1/prices')) return json({ id: `price_${calls.length}` });
    throw new Error(`unexpected url ${url}`);
  };

  const result = await provisionStripeCatalog({
    stripeSecretKey: 'sk_test_never_logged',
    fetcher,
    log: () => undefined,
  });

  assert.deepEqual(Object.keys(result.priceIDs), ['STRIPE_PRICE_GO', 'STRIPE_PRICE_PRO', 'STRIPE_PRICE_ULTRA']);
  assert.equal(calls.filter((call) => call.url.endsWith('/v1/products')).length, 3);
  assert.equal(calls.filter((call) => call.url.endsWith('/v1/prices')).length, 3);
  assert.equal(calls.find((call) => call.url.endsWith('/v1/prices')).body.get('recurring[interval]'), 'month');
  assert.equal(calls.find((call) => call.url.endsWith('/v1/prices')).body.get('currency'), 'brl');
});

test('reuses existing active prices from Stripe Search', async () => {
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({ url, body: new URLSearchParams(String(init?.body ?? '')) });
    if (url.includes('/v1/prices/search')) return json({
      data: [{ id: 'price_existing', active: true }],
    });
    throw new Error(`unexpected url ${url}`);
  };

  const result = await provisionStripeCatalog({
    stripeSecretKey: 'sk_test_never_logged',
    fetcher,
    log: () => undefined,
  });

  assert.equal(result.priceIDs.STRIPE_PRICE_GO, 'price_existing');
  assert.equal(result.priceIDs.STRIPE_PRICE_PRO, 'price_existing');
  assert.equal(result.priceIDs.STRIPE_PRICE_ULTRA, 'price_existing');
  assert.equal(calls.length, 3);
});
