import { useEffect, useRef, useState, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';

interface UseSecretKnockOptions {
  pattern: number[];
  tolerance: number;
  enabled: boolean;
  onKnockMatch: () => void;
}

export function useSecretKnock({
  pattern,
  tolerance,
  enabled,
  onKnockMatch,
}: UseSecretKnockOptions): { clickCount: number } {
  const [clickCount, setClickCount] = useState(0);
  const timestampsRef = useRef<number[]>([]);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onKnockMatchRef = useRef(onKnockMatch);
  onKnockMatchRef.current = onKnockMatch;

  const checkPattern = useCallback(
    (timestamps: number[]) => {
      if (timestamps.length < pattern.length + 1) return false;

      // Use the last N+1 timestamps to compute N intervals
      const recent = timestamps.slice(-(pattern.length + 1));
      const intervals: number[] = [];
      for (let i = 1; i < recent.length; i++) {
        intervals.push(recent[i] - recent[i - 1]);
      }

      // Compare intervals against pattern with tolerance
      for (let i = 0; i < pattern.length; i++) {
        if (Math.abs(intervals[i] - pattern[i]) > tolerance) {
          return false;
        }
      }
      return true;
    },
    [pattern, tolerance],
  );

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const setupListener = async () => {
      const unlisten = await listen<number>('tray-click', (event) => {
        if (cancelled) return;

        const ts = event.payload;
        timestampsRef.current.push(ts);
        setClickCount((c) => c + 1);

        // Reset buffer after 3 seconds of no clicks
        if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
        resetTimerRef.current = setTimeout(() => {
          timestampsRef.current = [];
          setClickCount(0);
        }, 3000);

        // Check for pattern match
        if (checkPattern(timestampsRef.current)) {
          timestampsRef.current = [];
          setClickCount(0);
          onKnockMatchRef.current();
        }
      });

      return unlisten;
    };

    let unlistenFn: (() => void) | null = null;
    setupListener().then((fn) => {
      if (cancelled) {
        fn();
      } else {
        unlistenFn = fn;
      }
    });

    return () => {
      cancelled = true;
      if (unlistenFn) unlistenFn();
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, [enabled, checkPattern]);

  return { clickCount };
}
