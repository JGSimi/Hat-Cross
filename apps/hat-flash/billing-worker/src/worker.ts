export type SubscriptionPlanKey = 'go' | 'pro' | 'ultra';
export type SubscriptionStatusName = 'none' | 'active' | 'trialing' | 'past_due' | 'incomplete' | 'canceled' | 'paused';

export interface AuthenticatedUser {
  uid: string;
  email?: string;
}

export interface BillingSession {
  url: string;
}

export interface SubscriptionStatus {
  status: SubscriptionStatusName;
  plan: SubscriptionPlanKey | null;
  currentPeriodEnd: number | null;
}

export interface CheckoutCommand {
  uid: string;
  email?: string;
  planKey: SubscriptionPlanKey;
  app: 'hat-flash';
}

export interface PortalCommand {
  uid: string;
  email?: string;
  app: 'hat-flash';
}

export interface StripeGateway {
  createCheckoutSession(command: CheckoutCommand): Promise<BillingSession>;
  createPortalSession?(command: PortalCommand): Promise<BillingSession>;
}

export interface BillingStore {
  getJSON<T>(key: string): Promise<T | null>;
  putJSON(key: string, value: unknown): Promise<void>;
}

export type FirebaseVerifier = (idToken: string) => Promise<AuthenticatedUser>;

export interface BillingHealth {
  ok: boolean;
  checks: {
    billingKV: boolean;
    stripeSecret: boolean;
    firebaseProject: boolean;
    stripePrices: boolean;
  };
}

interface BillingWorkerDependencies {
  stripe?: StripeGateway;
  verifyIDToken?: FirebaseVerifier;
  store?: BillingStore;
  handleWebhook?: (request: Request) => Promise<Response>;
  health?: () => BillingHealth;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Idempotency-Key, Stripe-Signature',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const nullStore: BillingStore = {
  async getJSON() {
    return null;
  },
  async putJSON() {
    return undefined;
  },
};

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export function subscriptionKey(uid: string) {
  return `subscription:${uid}`;
}

export function resolvePlanKey(value: unknown): SubscriptionPlanKey {
  if (value === 'go' || value === 'pro' || value === 'ultra') return value;
  throw new HttpError(400, 'Plano invalido.');
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function noContent() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

function routeFromURL(url: URL) {
  const path = url.pathname.replace(/\/+$/, '') || '/';
  return path.startsWith('/v1/billing') ? path.slice('/v1/billing'.length) || '/' : path;
}

function bearerToken(request: Request) {
  const raw = request.headers.get('Authorization') ?? '';
  const match = raw.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]?.trim()) throw new HttpError(401, 'Conecte sua conta Google para continuar.');
  return match[1].trim();
}

async function parseJSON(request: Request) {
  try {
    return await request.json() as Record<string, unknown>;
  } catch {
    throw new HttpError(400, 'JSON invalido.');
  }
}

async function authenticatedUser(request: Request, verifyIDToken?: FirebaseVerifier) {
  if (!verifyIDToken) throw new HttpError(500, 'Firebase verifier nao configurado.');
  return verifyIDToken(bearerToken(request));
}

function normalizeStoredStatus(value: SubscriptionStatus | null): SubscriptionStatus {
  if (!value) return { status: 'none', plan: null, currentPeriodEnd: null };
  return {
    status: value.status,
    plan: value.plan,
    currentPeriodEnd: value.currentPeriodEnd,
  };
}

export function createBillingWorker(dependencies: BillingWorkerDependencies = {}) {
  const store = dependencies.store ?? nullStore;

  return {
    async fetch(request: Request): Promise<Response> {
      if (request.method === 'OPTIONS') return noContent();

      try {
        const url = new URL(request.url);
        const route = routeFromURL(url);

        if (route === '/healthz' && request.method === 'GET') {
          return json(dependencies.health?.() ?? {
            ok: false,
            checks: {
              billingKV: false,
              stripeSecret: false,
              firebaseProject: false,
              stripePrices: false,
            },
          });
        }

        if (route === '/checkout' && request.method === 'POST') {
          if (!dependencies.stripe) throw new HttpError(500, 'Stripe nao configurado.');
          const [user, body] = await Promise.all([
            authenticatedUser(request, dependencies.verifyIDToken),
            parseJSON(request),
          ]);
          const session = await dependencies.stripe.createCheckoutSession({
            uid: user.uid,
            email: user.email,
            planKey: resolvePlanKey(body.plan),
            app: 'hat-flash',
          });
          return json(session);
        }

        if (route === '/portal' && request.method === 'POST') {
          if (!dependencies.stripe?.createPortalSession) throw new HttpError(500, 'Portal Stripe nao configurado.');
          const user = await authenticatedUser(request, dependencies.verifyIDToken);
          const session = await dependencies.stripe.createPortalSession({
            uid: user.uid,
            email: user.email,
            app: 'hat-flash',
          });
          return json(session);
        }

        if (route === '/subscription' && request.method === 'GET') {
          const user = await authenticatedUser(request, dependencies.verifyIDToken);
          return json(normalizeStoredStatus(await store.getJSON<SubscriptionStatus>(subscriptionKey(user.uid))));
        }

        if (route === '/webhook' && request.method === 'POST') {
          if (!dependencies.handleWebhook) throw new HttpError(500, 'Stripe webhook nao configurado.');
          const response = await dependencies.handleWebhook(request);
          const headers = new Headers(corsHeaders);
          response.headers.forEach((value, key) => headers.set(key, value));
          return new Response(response.body, {
            status: response.status,
            headers,
          });
        }

        return json({ error: 'Not found' }, 404);
      } catch (err) {
        if (err instanceof HttpError) return json({ error: err.message }, err.status);
        const message = err instanceof Error && err.message ? err.message : 'Billing indisponivel.';
        return json({ error: message }, 500);
      }
    },
  };
}
