import type { ErrorKind } from "./ErrorKind";

const FIREBASE_CODE_MAP: Record<string, ErrorKind> = {
  "auth/popup-blocked": "firebase-auth-popup-blocked",
  "auth/network-request-failed": "firebase-auth-network-request-failed",
  "auth/account-exists-with-different-credential":
    "firebase-auth-account-exists-with-different-credential",
  "auth/invalid-credential": "firebase-auth-invalid-credential",
  "auth/too-many-requests": "firebase-auth-too-many-requests",
};

/**
 * Hat proxy Worker → Rust → frontend wire protocol: errors arrive as
 * strings of the form `error:<code>[:status][:detail]`. The frontend
 * MUST map these to `ErrorKind` before showing anything to the user —
 * leaking the raw wire string reveals the upstream model name
 * (e.g. "Gemini 503") and internal HTTP details, which is both a
 * branding leak and a bad UX. Reported 2026-04-23 with a screenshot
 * showing a raw `error:serverError:500:Gemini 503: { ... }` in a
 * chat bubble.
 */
const BACKEND_CODE_MAP: Record<string, ErrorKind> = {
  sessionExpired: "firebase-auth-invalid-credential",
  insufficientCredits: "credits-insufficient",
  rateLimited: "provider-429",
  serverError: "provider-5xx",
  unknownError: "unknown",
};

/** Parses `error:<code>:...` into an {@link ErrorKind}, or null when not a backend wire string. */
export function classifyBackendWireError(raw: string): ErrorKind | null {
  if (!raw.startsWith("error:")) return null;
  const parts = raw.split(":");
  const code = parts[1];
  if (!code) return "unknown";
  return BACKEND_CODE_MAP[code] ?? "unknown";
}

function hasProp<K extends string>(
  value: unknown,
  key: K,
): value is Record<K, unknown> {
  return typeof value === "object" && value !== null && key in value;
}

/**
 * Collapse any thrown value into a canonical {@link ErrorKind}.
 *
 * Order of checks:
 *  1. Offline probe via `navigator.onLine`
 *  2. Firebase error shape (`{ code: 'auth/...' }`)
 *  3. Fetch / HTTP response shape (`{ status: number }`)
 *  4. `Error` instance by `name` / `message` heuristics
 *  5. Plain strings (Tauri sometimes throws strings)
 *  6. Fallback to `unknown`
 *
 * Keep heuristics in pt-BR and en-US — messages may come from either locale.
 */
export function classifyError(err: unknown): ErrorKind {
  if (err == null) return "unknown";

  // Backend wire protocol — classify BEFORE the offline probe because
  // a `serverError` is "upstream is sick", not "user is offline".
  if (typeof err === "string") {
    const wire = classifyBackendWireError(err);
    if (wire) return wire;
  }
  if (err instanceof Error) {
    const wire = classifyBackendWireError(err.message);
    if (wire) return wire;
  }

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "network-offline";
  }

  if (hasProp(err, "code")) {
    const code = err.code;
    if (typeof code === "string") {
      if (FIREBASE_CODE_MAP[code]) return FIREBASE_CODE_MAP[code];
      if (code.startsWith("auth/")) return "firebase-auth-invalid-credential";
    }
  }

  if (hasProp(err, "status")) {
    const status = err.status;
    if (typeof status === "number") {
      if (status === 401 || status === 403) return "provider-401";
      if (status === 429) return "provider-429";
      if (status >= 500 && status < 600) return "provider-5xx";
    }
  }

  if (err instanceof Error) {
    const name = err.name;
    const msg = err.message.toLowerCase();

    if (name === "AbortError" || msg.includes("timeout") || msg.includes("timed out")) {
      return "provider-timeout";
    }
    if (
      msg.includes("context length") ||
      msg.includes("context_length") ||
      msg.includes("too many tokens") ||
      msg.includes("maximum context")
    ) {
      return "provider-context-exceeded";
    }
    if (msg.includes("content filter") || msg.includes("content_policy")) {
      return "provider-content-filter";
    }
    if (msg.includes("capability") && msg.includes("denied")) {
      return "tauri-capability-denied";
    }
    if (msg.includes("forbidden path") || msg.includes("fs.") || msg.includes("readdir")) {
      return "tauri-fs-error";
    }
    if (msg.includes("clipboard")) {
      return "clipboard-read-failed";
    }
    if (msg.includes("credits") || msg.includes("créditos") || msg.includes("saldo")) {
      return "credits-insufficient";
    }
    if (msg.includes("invoke") || msg.includes("tauri::command")) {
      return "tauri-command-failed";
    }
  }

  if (typeof err === "string") {
    const s = err.toLowerCase();
    if (s.includes("capability")) return "tauri-capability-denied";
    if (s.includes("fs")) return "tauri-fs-error";
    if (s.includes("clipboard")) return "clipboard-read-failed";
  }

  return "unknown";
}
