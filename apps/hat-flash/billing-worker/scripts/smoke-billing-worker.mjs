#!/usr/bin/env node

export function buildSmokeTargets(baseURL) {
  const normalized = baseURL.replace(/\/+$/, '');
  return {
    healthz: `${normalized}/healthz`,
    subscription: `${normalized}/subscription`,
  };
}

async function expectResponse(response, predicate, message) {
  if (!predicate(response)) {
    const body = await response.text().catch(() => '');
    throw new Error(`${message}: ${response.status} ${body}`.trim());
  }
}

async function readJSON(response) {
  try {
    return await response.json();
  } catch {
    throw new Error('Expected JSON response.');
  }
}

export async function smokeBillingWorker({
  baseURL,
  fetcher = fetch,
  log = console.log,
} = {}) {
  if (!baseURL?.trim()) throw new Error('BILLING_WORKER_URL missing.');
  const targets = buildSmokeTargets(baseURL.trim());

  const preflight = await fetcher(targets.subscription, {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://hat-flash.com',
      'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Headers': 'Authorization',
    },
  });
  await expectResponse(
    preflight,
    (response) => response.status === 204 && response.headers.get('Access-Control-Allow-Origin') === '*',
    'CORS preflight failed',
  );

  const health = await fetcher(targets.healthz);
  await expectResponse(health, (response) => response.ok, 'healthz failed');
  const healthPayload = await readJSON(health);
  if (!healthPayload.ok) {
    throw new Error(`billing worker not ready: ${JSON.stringify(healthPayload.checks ?? {})}`);
  }

  const subscription = await fetcher(targets.subscription);
  await expectResponse(subscription, (response) => response.status === 401, 'subscription auth gate failed');

  log(`Billing Worker smoke ok: ${baseURL}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  smokeBillingWorker({ baseURL: process.env.BILLING_WORKER_URL || process.argv[2] })
    .catch((err) => {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    });
}
