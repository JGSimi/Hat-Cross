# Hat Flash Billing Worker

Stripe subscription backend for Hat Flash desktop.

Routes:

- `POST /v1/billing/checkout` creates a Stripe Checkout Session with `mode=subscription`.
- `POST /v1/billing/portal` creates a Stripe Customer Portal Session.
- `GET /v1/billing/subscription` returns the stored subscription status for the Firebase user.
- `POST /v1/billing/webhook` verifies Stripe webhook signatures and stores subscription status in KV.

Required setup:

1. Create Stripe Products/Prices for monthly plans Go, Pro, Ultra.
2. Set Worker secrets:

```bash
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put STRIPE_WEBHOOK_SECRET
wrangler secret put FIREBASE_PROJECT_ID
wrangler secret put STRIPE_PRICE_GO
wrangler secret put STRIPE_PRICE_PRO
wrangler secret put STRIPE_PRICE_ULTRA
```

3. Create/bind `BILLING_KV` and replace the IDs in `wrangler.toml`.
4. Point the desktop app at this Worker with `VITE_HAT_BILLING_BASE_URL`, or deploy it at the existing Hat proxy path `/v1/billing`.

Stripe docs used for this design:

- Checkout subscriptions: https://docs.stripe.com/payments/checkout/subscriptions
- Customer Portal: https://docs.stripe.com/customer-management
- Webhook signatures: https://docs.stripe.com/webhooks/signature
