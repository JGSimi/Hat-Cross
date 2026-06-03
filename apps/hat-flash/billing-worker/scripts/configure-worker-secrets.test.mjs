import assert from 'node:assert/strict';
import test from 'node:test';
import {
  REQUIRED_WORKER_SECRETS,
  missingSecrets,
  secretPutCommands,
} from './configure-worker-secrets.mjs';

test('knows every secret required for live Stripe billing', () => {
  assert.deepEqual(REQUIRED_WORKER_SECRETS, [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'FIREBASE_PROJECT_ID',
    'STRIPE_PRICE_GO',
    'STRIPE_PRICE_PRO',
    'STRIPE_PRICE_ULTRA',
  ]);
});

test('reports missing secrets without revealing present values', () => {
  const env = {
    STRIPE_SECRET_KEY: 'sk_test_secret',
    STRIPE_PRICE_GO: 'price_go',
  };

  assert.deepEqual(missingSecrets(env), [
    'STRIPE_WEBHOOK_SECRET',
    'FIREBASE_PROJECT_ID',
    'STRIPE_PRICE_PRO',
    'STRIPE_PRICE_ULTRA',
  ]);
});

test('builds wrangler commands with secret values only in stdin payloads', () => {
  const commands = secretPutCommands({
    STRIPE_SECRET_KEY: 'sk_test_secret',
    STRIPE_WEBHOOK_SECRET: 'whsec_secret',
    FIREBASE_PROJECT_ID: 'hat-cross',
    STRIPE_PRICE_GO: 'price_go',
    STRIPE_PRICE_PRO: 'price_pro',
    STRIPE_PRICE_ULTRA: 'price_ultra',
  });

  assert.equal(commands.length, 6);
  assert.deepEqual(commands[0], {
    name: 'STRIPE_SECRET_KEY',
    command: ['npx', 'wrangler', 'secret', 'put', 'STRIPE_SECRET_KEY'],
    stdin: 'sk_test_secret',
  });
});
