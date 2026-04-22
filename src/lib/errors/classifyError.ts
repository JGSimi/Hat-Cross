import type { ErrorKind } from "./ErrorKind";

const FIREBASE_CODE_MAP: Record<string, ErrorKind> = {
  "auth/popup-blocked": "firebase-auth-popup-blocked",
  "auth/network-request-failed": "firebase-auth-network-request-failed",
  "auth/account-exists-with-different-credential":
    "firebase-auth-account-exists-with-different-credential",
  "auth/invalid-credential": "firebase-auth-invalid-credential",
  "auth/too-many-requests": "firebase-auth-too-many-requests",
};

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
