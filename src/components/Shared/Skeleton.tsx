import type { CSSProperties } from 'react';
import { useReducedMotion } from 'framer-motion';

interface SkeletonProps {
  /** Width — number (px) or any CSS length. Defaults to 100%. */
  width?: number | string;
  /** Height — number (px) or any CSS length. Required because a shimmer
   * block with zero height collapses silently; make it explicit. */
  height: number | string;
  /** Corner radius — defaults to 6px (matches our radius-sm token). */
  radius?: number | string;
  className?: string;
  style?: CSSProperties;
  /** Override the default aria-label. The primitive defaults to
   * aria-hidden because skeletons are decorative — the surrounding
   * region usually already declares aria-busy / aria-live. Pass a
   * label when the skeleton IS the live region. */
  ariaLabel?: string;
}

/**
 * Generic loading placeholder. Uses the shimmer keyframes already
 * declared in src/index.css. Under `prefers-reduced-motion: reduce`,
 * falls back to a subtle opacity pulse via framer-motion — no
 * horizontal shimmer that can trigger vestibular issues.
 */
export default function Skeleton({
  width = '100%',
  height,
  radius = 6,
  className,
  style,
  ariaLabel,
}: SkeletonProps) {
  const reduced = useReducedMotion();

  const base: CSSProperties = {
    display: 'inline-block',
    width,
    height,
    borderRadius: radius,
    background: reduced
      ? 'color-mix(in srgb, var(--text-muted) 18%, transparent)'
      : 'linear-gradient(90deg, color-mix(in srgb, var(--text-muted) 10%, transparent) 0%, color-mix(in srgb, var(--text-muted) 22%, transparent) 50%, color-mix(in srgb, var(--text-muted) 10%, transparent) 100%)',
    backgroundSize: reduced ? undefined : '200% 100%',
    animation: reduced ? 'skeleton-pulse 1.4s ease-in-out infinite' : 'shimmer 1.4s linear infinite',
    flexShrink: 0,
  };

  const a11y = ariaLabel
    ? { role: 'status' as const, 'aria-label': ariaLabel, 'aria-busy': true }
    : ({ 'aria-hidden': true } as const);

  return <span className={className} style={{ ...base, ...style }} {...a11y} />;
}
