#!/usr/bin/env node

const STRIPE_API_BASE_URL = 'https://api.stripe.com';

export const HAT_FLASH_PLANS = [
  {
    key: 'go',
    name: 'Hat Flash Go',
    amountBRL: 20,
    envName: 'STRIPE_PRICE_GO',
    description: 'Uso pessoal do Hat Flash.',
  },
  {
    key: 'pro',
    name: 'Hat Flash Pro',
    amountBRL: 50,
    envName: 'STRIPE_PRICE_PRO',
    description: 'Hat Flash com salas compartilhadas e modo Pro.',
  },
  {
    key: 'ultra',
    name: 'Hat Flash Ultra',
    amountBRL: 99,
    envName: 'STRIPE_PRICE_ULTRA',
    description: 'Hat Flash completo com prioridade no proxy.',
  },
];

export function stripeForm(values) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null || value === '') continue;
    body.set(key, String(value));
  }
  return body;
}

async function stripeRequest(path, stripeSecretKey, fetcher, body) {
  const response = await fetcher(`${STRIPE_API_BASE_URL}${path}`, {
    method: 'POST',
    headers: new Headers({
      Authorization: `Bearer ${stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    }),
    body: body.toString(),
  });
  const payload = await response.json();
  if (!response.ok) {
    const message = payload?.error?.message || `Stripe request failed: ${path}`;
    throw new Error(message);
  }
  return payload;
}

async function findExistingPrice(plan, stripeSecretKey, fetcher) {
  const query = [
    `metadata['app']:'hat-flash'`,
    `metadata['plan']:'${plan.key}'`,
    "active:'true'",
  ].join(' AND ');
  const payload = await stripeRequest(
    '/v1/prices/search',
    stripeSecretKey,
    fetcher,
    stripeForm({ query, limit: 1 }),
  );
  return payload?.data?.[0]?.id || '';
}

async function createProduct(plan, stripeSecretKey, fetcher) {
  const payload = await stripeRequest(
    '/v1/products',
    stripeSecretKey,
    fetcher,
    stripeForm({
      name: plan.name,
      description: plan.description,
      'metadata[app]': 'hat-flash',
      'metadata[plan]': plan.key,
    }),
  );
  if (!payload.id) throw new Error(`Stripe did not return product id for ${plan.key}`);
  return payload.id;
}

async function createMonthlyPrice(plan, productID, stripeSecretKey, fetcher) {
  const payload = await stripeRequest(
    '/v1/prices',
    stripeSecretKey,
    fetcher,
    stripeForm({
      product: productID,
      currency: 'brl',
      unit_amount: plan.amountBRL * 100,
      'recurring[interval]': 'month',
      'lookup_key': `hat_flash_${plan.key}_monthly_brl`,
      'metadata[app]': 'hat-flash',
      'metadata[plan]': plan.key,
    }),
  );
  if (!payload.id) throw new Error(`Stripe did not return price id for ${plan.key}`);
  return payload.id;
}

export async function provisionStripeCatalog({
  stripeSecretKey,
  fetcher = fetch,
  log = console.log,
} = {}) {
  if (!stripeSecretKey?.trim()) throw new Error('STRIPE_SECRET_KEY missing.');

  const priceIDs = {};
  for (const plan of HAT_FLASH_PLANS) {
    const existingPriceID = await findExistingPrice(plan, stripeSecretKey, fetcher);
    if (existingPriceID) {
      priceIDs[plan.envName] = existingPriceID;
      log(`${plan.envName}=${existingPriceID} # existing`);
      continue;
    }

    const productID = await createProduct(plan, stripeSecretKey, fetcher);
    const priceID = await createMonthlyPrice(plan, productID, stripeSecretKey, fetcher);
    priceIDs[plan.envName] = priceID;
    log(`${plan.envName}=${priceID}`);
  }

  return { priceIDs };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  provisionStripeCatalog({ stripeSecretKey: process.env.STRIPE_SECRET_KEY })
    .then(({ priceIDs }) => {
      console.log('\nSet these Worker secrets with wrangler:');
      for (const [envName, priceID] of Object.entries(priceIDs)) {
        console.log(`printf %s '${priceID}' | npx wrangler secret put ${envName}`);
      }
    })
    .catch((err) => {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    });
}
