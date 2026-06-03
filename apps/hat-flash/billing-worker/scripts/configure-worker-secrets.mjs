#!/usr/bin/env node

import { spawn } from 'node:child_process';

export const REQUIRED_WORKER_SECRETS = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'FIREBASE_PROJECT_ID',
  'STRIPE_PRICE_GO',
  'STRIPE_PRICE_PRO',
  'STRIPE_PRICE_ULTRA',
];

export function missingSecrets(env = process.env) {
  return REQUIRED_WORKER_SECRETS.filter((name) => !env[name]?.trim());
}

export function secretPutCommands(env = process.env) {
  return REQUIRED_WORKER_SECRETS.map((name) => ({
    name,
    command: ['npx', 'wrangler', 'secret', 'put', name],
    stdin: env[name],
  }));
}

function runSecretCommand({ name, command, stdin }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command[0], command.slice(1), {
      stdio: ['pipe', 'inherit', 'inherit'],
    });
    child.stdin.end(stdin);
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`wrangler secret put failed for ${name}`));
    });
  });
}

export async function configureWorkerSecrets(env = process.env) {
  const missing = missingSecrets(env);
  if (missing.length) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }

  for (const command of secretPutCommands(env)) {
    console.log(`Setting ${command.name}`);
    await runSecretCommand(command);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  configureWorkerSecrets()
    .catch((err) => {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    });
}
