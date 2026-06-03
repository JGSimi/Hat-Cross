#!/usr/bin/env node

export const BILLING_RELEASE_ENV = [
  { name: 'VITE_FIREBASE_API_KEY', scope: 'desktop-build' },
  { name: 'VITE_FIREBASE_AUTH_DOMAIN', scope: 'desktop-build' },
  { name: 'VITE_FIREBASE_PROJECT_ID', scope: 'desktop-build' },
  { name: 'VITE_FIREBASE_APP_ID', scope: 'desktop-build' },
  { name: 'VITE_HAT_BILLING_BASE_URL', scope: 'desktop-build' },
  { name: 'FIREBASE_PROJECT_ID', scope: 'worker-secret' },
  { name: 'STRIPE_SECRET_KEY', scope: 'worker-secret' },
  { name: 'STRIPE_WEBHOOK_SECRET', scope: 'worker-secret' },
  { name: 'STRIPE_PRICE_GO', scope: 'worker-secret' },
  { name: 'STRIPE_PRICE_PRO', scope: 'worker-secret' },
  { name: 'STRIPE_PRICE_ULTRA', scope: 'worker-secret' },
];

function scopedEntries(scope) {
  if (!scope) return BILLING_RELEASE_ENV;
  return BILLING_RELEASE_ENV.filter((entry) => entry.scope === scope);
}

export function missingBillingReleaseEnv(env = process.env, options = {}) {
  return scopedEntries(options.scope)
    .filter((entry) => !env[entry.name]?.trim())
    .map(({ name, scope }) => ({ name, scope }));
}

function billingURLWarning(env) {
  const value = env.VITE_HAT_BILLING_BASE_URL?.trim();
  if (!value) return null;

  let url;
  try {
    url = new URL(value);
  } catch {
    return 'VITE_HAT_BILLING_BASE_URL must be a valid absolute URL.';
  }

  if (url.protocol !== 'https:') {
    return 'VITE_HAT_BILLING_BASE_URL must use https.';
  }

  if (!url.pathname.replace(/\/+$/, '').endsWith('/v1/billing')) {
    return 'VITE_HAT_BILLING_BASE_URL should end with /v1/billing.';
  }

  return null;
}

function firebaseProjectWarning(env) {
  const clientProject = env.VITE_FIREBASE_PROJECT_ID?.trim();
  const workerProject = env.FIREBASE_PROJECT_ID?.trim();
  if (!clientProject || !workerProject || clientProject === workerProject) return null;
  return 'FIREBASE_PROJECT_ID should match VITE_FIREBASE_PROJECT_ID.';
}

export function checkBillingReleaseEnv(env = process.env, options = {}) {
  const missing = missingBillingReleaseEnv(env, options);
  const warnings = [
    billingURLWarning(env),
    options.scope ? null : firebaseProjectWarning(env),
  ].filter(Boolean);

  return {
    ok: missing.length === 0 && warnings.every((warning) => !warning.includes('must') && !warning.includes('should end')),
    missing,
    warnings,
  };
}

export function formatBillingReleaseCheck(result) {
  const lines = [];
  if (result.missing.length) {
    lines.push('Missing billing release env vars:');
    for (const entry of result.missing) {
      lines.push(`- ${entry.name} (${entry.scope})`);
    }
  }

  if (result.warnings.length) {
    lines.push('Billing release env warnings:');
    for (const warning of result.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  if (!lines.length) return 'Billing release env ok.';
  return lines.join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const scopeArg = process.argv.find((arg) => arg.startsWith('--scope='));
  const result = checkBillingReleaseEnv(process.env, {
    scope: scopeArg ? scopeArg.slice('--scope='.length) : undefined,
  });
  console.log(formatBillingReleaseCheck(result));
  if (!result.ok) process.exitCode = 1;
}
