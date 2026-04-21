// Animated theme switch: radial wipe from the click origin using the View
// Transitions API when available, with a graceful fallback that globally
// transitions color properties for the duration of the swap.
//
// Usage:
//   runThemeTransition(event, () => applyTheme(next))
//
// The `apply` callback is invoked synchronously inside the VT callback so the
// browser captures the new state for the outgoing-to-incoming animation.

type TransitionEvent = { clientX: number; clientY: number };

const FALLBACK_DURATION_MS = 1150;
const FALLBACK_CLASS = 'theme-transitioning';

function setOriginVars(event?: TransitionEvent) {
  const root = document.documentElement;
  if (event) {
    root.style.setProperty('--theme-x', `${event.clientX}px`);
    root.style.setProperty('--theme-y', `${event.clientY}px`);
  } else {
    root.style.setProperty('--theme-x', '50%');
    root.style.setProperty('--theme-y', '50%');
  }
}

export function runThemeTransition(
  event: TransitionEvent | undefined,
  apply: () => void,
) {
  setOriginVars(event);

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // View Transitions API path — a smooth radial reveal
  const doc = document as Document & {
    startViewTransition?: (cb: () => void | Promise<void>) => {
      finished: Promise<void>;
    };
  };

  if (!reducedMotion && typeof doc.startViewTransition === 'function') {
    const transition = doc.startViewTransition(() => {
      apply();
    });
    transition.finished.catch(() => {
      /* user may navigate away mid-transition — safe to ignore */
    });
    return;
  }

  // Fallback: blanket color transition for a fixed window
  if (reducedMotion) {
    apply();
    return;
  }

  const root = document.documentElement;
  root.classList.add(FALLBACK_CLASS);
  apply();
  window.setTimeout(() => {
    root.classList.remove(FALLBACK_CLASS);
  }, FALLBACK_DURATION_MS);
}
