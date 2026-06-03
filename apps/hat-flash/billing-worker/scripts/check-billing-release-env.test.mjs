import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BILLING_RELEASE_ENV,
  checkBillingReleaseEnv,
  missingBillingReleaseEnv,
} from './check-billing-release-env.mjs';

const completeEnv = {
  VITE_FIREBASE_API_KEY: 'AIzaSy-test',
  VITE_FIREBASE_AUTH_DOMAIN: 'hat-cross.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'hat-cross',
  VITE_FIREBASE_APP_ID: '1:123:web:abc',
  VITE_HAT_BILLING_BASE_URL: 'https://hat-flash-billing.example.workers.dev/v1/billing',
  FIREBASE_PROJECT_ID: 'hat-cross',
  STRIPE_SECRET_KEY: 'sk_live_test',
  STRIPE_WEBHOOK_SECRET: 'whsec_test',
  STRIPE_PRICE_GO: 'price_go',
  STRIPE_PRICE_PRO: 'price_pro',
  STRIPE_PRICE_ULTRA: 'price_ultra',
};

test('describes every env var required for a live billing release', () => {
  assert.deepEqual(
    BILLING_RELEASE_ENV.map((entry) => entry.name),
    [
      'VITE_FIREBASE_API_KEY',
      'VITE_FIREBASE_AUTH_DOMAIN',
      'VITE_FIREBASE_PROJECT_ID',
      'VITE_FIREBASE_APP_ID',
      'VITE_HAT_BILLING_BASE_URL',
      'FIREBASE_PROJECT_ID',
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'STRIPE_PRICE_GO',
      'STRIPE_PRICE_PRO',
      'STRIPE_PRICE_ULTRA',
    ],
  );
});

test('reports missing billing release env vars without leaking values', () => {
  assert.deepEqual(missingBillingReleaseEnv({
    ...completeEnv,
    STRIPE_SECRET_KEY: '',
    STRIPE_PRICE_ULTRA: '  ',
  }), [
    { name: 'STRIPE_SECRET_KEY', scope: 'worker-secret' },
    { name: 'STRIPE_PRICE_ULTRA', scope: 'worker-secret' },
  ]);
});

test('can check only the desktop build environment', () => {
  assert.deepEqual(checkBillingReleaseEnv({
    VITE_FIREBASE_API_KEY: 'AIzaSy-test',
    VITE_FIREBASE_AUTH_DOMAIN: 'hat-cross.firebaseapp.com',
    VITE_FIREBASE_PROJECT_ID: 'hat-cross',
    VITE_FIREBASE_APP_ID: '1:123:web:abc',
    VITE_HAT_BILLING_BASE_URL: 'https://hat-flash-billing.example.workers.dev/v1/billing',
  }, { scope: 'desktop-build' }), {
    ok: true,
    missing: [],
    warnings: [],
  });
});

test('desktop build env check does not require worker secrets', () => {
  assert.deepEqual(missingBillingReleaseEnv({}, { scope: 'desktop-build' }), [
    { name: 'VITE_FIREBASE_API_KEY', scope: 'desktop-build' },
    { name: 'VITE_FIREBASE_AUTH_DOMAIN', scope: 'desktop-build' },
    { name: 'VITE_FIREBASE_PROJECT_ID', scope: 'desktop-build' },
    { name: 'VITE_FIREBASE_APP_ID', scope: 'desktop-build' },
    { name: 'VITE_HAT_BILLING_BASE_URL', scope: 'desktop-build' },
  ]);
});

test('accepts a complete production billing release environment', () => {
  assert.deepEqual(checkBillingReleaseEnv(completeEnv), {
    ok: true,
    missing: [],
    warnings: [],
  });
});

test('warns when Firebase project ids do not match', () => {
  assert.deepEqual(checkBillingReleaseEnv({
    ...completeEnv,
    FIREBASE_PROJECT_ID: 'other-project',
  }), {
    ok: true,
    missing: [],
    warnings: ['FIREBASE_PROJECT_ID should match VITE_FIREBASE_PROJECT_ID.'],
  });
});

test('rejects a billing base URL outside the /v1/billing API', () => {
  assert.deepEqual(checkBillingReleaseEnv({
    ...completeEnv,
    VITE_HAT_BILLING_BASE_URL: 'https://hat-flash-billing.example.workers.dev',
  }), {
    ok: false,
    missing: [],
    warnings: ['VITE_HAT_BILLING_BASE_URL should end with /v1/billing.'],
  });
});
