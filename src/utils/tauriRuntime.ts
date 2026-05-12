type TauriWindow = Window & {
  __TAURI_INTERNALS__?: {
    invoke?: unknown;
  };
};

export function isTauriRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  const internals = (window as TauriWindow).__TAURI_INTERNALS__;
  return typeof internals?.invoke === 'function';
}
