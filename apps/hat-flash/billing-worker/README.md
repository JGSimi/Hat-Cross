# Hat Flash Billing Worker

Stripe subscription backend for Hat Flash desktop.

Routes:

- `POST /v1/billing/checkout` creates a Stripe Checkout Session with `mode=subscription`.
- `POST /v1/billing/portal` creates a Stripe Customer Portal Session.
- `GET /v1/billing/subscription` returns the stored subscription status for the Firebase user.
- `POST /v1/billing/webhook` verifies Stripe webhook signatures and stores subscription status in KV.

Required setup:

1. Create Stripe Products/Prices for monthly plans Go, Pro, Ultra:

```bash
STRIPE_SECRET_KEY=sk_live_... npm run stripe:provision-catalog
```

The script is idempotent: it reuses active Stripe Prices tagged with `app=hat-flash` and the plan key when they already exist. Copy the printed `STRIPE_PRICE_*` values into your environment.

2. Confirm the Worker package is deployable:

```bash
npm run test:billing-worker
npm run test:billing-scripts
npm run dry-run:billing-worker
```

3. Deploy the Worker once so Cloudflare can accept Worker secrets:

```bash
npm run deploy:billing-worker
```

4. Set Worker secrets from environment variables:

```bash
export STRIPE_SECRET_KEY=sk_live_...
export STRIPE_WEBHOOK_SECRET=whsec_...
export FIREBASE_PROJECT_ID=...
export STRIPE_PRICE_GO=price_...
export STRIPE_PRICE_PRO=price_...
export STRIPE_PRICE_ULTRA=price_...
npm run check:billing-release-env
npm run configure:billing-worker-secrets
```

5. Deploy again after secrets are present:

```bash
npm run deploy:billing-worker
```

6. Smoke the deployed Worker:

```bash
BILLING_WORKER_URL=https://hat-flash-billing.<account>.workers.dev/v1/billing npm run smoke:billing-worker
```

The smoke command checks CORS, `/healthz`, and that `/subscription` still requires Firebase auth.

7. Point the desktop app at this Worker with `VITE_HAT_BILLING_BASE_URL`, or route the existing Hat proxy path `/v1/billing` to this Worker.

Current Cloudflare setup:

- `BILLING_KV` production namespace is bound in `wrangler.toml`.
- `BILLING_KV` preview namespace is bound in `wrangler.toml`.
- The Worker must still be deployed and configured with Stripe/Firebase secrets before live billing works.

Stripe docs used for this design:

- Checkout subscriptions: https://docs.stripe.com/payments/checkout/subscriptions
- Customer Portal: https://docs.stripe.com/customer-management
- Webhook signatures: https://docs.stripe.com/webhooks/signature
