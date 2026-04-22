/**
 * Canonical taxonomy for errors surfaced in the Hat-Cross UI.
 *
 * Every user-facing error must collapse onto an `ErrorKind` so the
 * UI layer can render a mapped copy via i18n (`errors.{kind}`),
 * the retry layer (`withRetry`) can pick a strategy, and the
 * telemetry layer can bucket counts.
 *
 * Do not leak raw provider / Firebase strings to the UI — call
 * `classifyError` first.
 */

export type FirebaseAuthKind =
  | "firebase-auth-popup-blocked"
  | "firebase-auth-network-request-failed"
  | "firebase-auth-account-exists-with-different-credential"
  | "firebase-auth-invalid-credential"
  | "firebase-auth-too-many-requests";

export type ProviderKind =
  | "provider-401"
  | "provider-429"
  | "provider-5xx"
  | "provider-timeout"
  | "provider-context-exceeded"
  | "provider-content-filter";

export type TauriKind =
  | "tauri-command-failed"
  | "tauri-capability-denied"
  | "tauri-fs-error";

export type ErrorKind =
  | "network-offline"
  | FirebaseAuthKind
  | ProviderKind
  | TauriKind
  | "clipboard-read-failed"
  | "credits-insufficient"
  | "unknown";

/** Errors that should never auto-retry — user action required. */
export const NON_RETRYABLE: ReadonlySet<ErrorKind> = new Set<ErrorKind>([
  "provider-401",
  "provider-content-filter",
  "provider-context-exceeded",
  "firebase-auth-popup-blocked",
  "firebase-auth-invalid-credential",
  "firebase-auth-account-exists-with-different-credential",
  "tauri-capability-denied",
  "credits-insufficient",
]);
