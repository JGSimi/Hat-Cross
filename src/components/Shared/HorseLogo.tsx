import type { CSSProperties } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Sparkles } from "lucide-react";
import horseLogoUrl from "../../assets/horse-logo.svg";

export type HorseLogoState = "idle" | "thinking" | "celebrating" | "stealth";

interface HorseLogoProps {
  size?: number;
  /** Discrete visual state. Defaults to `idle`, or `thinking` when `animated` is true. */
  state?: HorseLogoState;
  /** @deprecated — use `state="thinking"`. Kept for existing call sites. */
  animated?: boolean;
  className?: string;
  color?: string;
  /** Omit to render decoratively (aria-hidden + role=presentation). */
  ariaLabel?: string;
}

const SPARKLE_ANGLES = [-35, 0, 35] as const;

function buildMaskStyle(size: number): CSSProperties {
  return {
    width: size,
    height: size,
    maskImage: `url(${horseLogoUrl})`,
    maskSize: "contain",
    maskRepeat: "no-repeat",
    maskPosition: "center",
    WebkitMaskImage: `url(${horseLogoUrl})`,
    WebkitMaskSize: "contain",
    WebkitMaskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    flexShrink: 0,
  };
}

export default function HorseLogo({
  size = 26,
  state,
  animated,
  className,
  color,
  ariaLabel,
}: HorseLogoProps) {
  const reduced = useReducedMotion();
  const resolvedState: HorseLogoState = state ?? (animated ? "thinking" : "idle");

  const a11y = ariaLabel
    ? { role: "img" as const, "aria-label": ariaLabel }
    : ({ "aria-hidden": true, role: "presentation" as const } as const);

  const mask = buildMaskStyle(size);

  if (resolvedState === "celebrating") {
    return (
      <motion.div
        className={className}
        style={{
          position: "relative",
          display: "inline-flex",
          width: size,
          height: size,
        }}
        {...a11y}
      >
        <motion.div
          style={mask}
          initial={false}
          animate={reduced ? undefined : { y: [0, -6, 0], scale: [1, 1.04, 1] }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <div
            style={{
              ...mask,
              background: color || "var(--color-accent)",
            }}
          />
        </motion.div>
        {!reduced && (
          <AnimatePresence>
            {SPARKLE_ANGLES.map((angle, i) => {
              const rad = (angle * Math.PI) / 180;
              return (
                <motion.span
                  key={`sparkle-${angle}`}
                  initial={{ opacity: 0, scale: 0.3, x: 0, y: 0 }}
                  animate={{
                    opacity: [0, 1, 0],
                    scale: [0.3, 1, 0.6],
                    x: Math.cos(rad) * size * 0.6,
                    y: Math.sin(rad) * size * 0.6 - size * 0.3,
                  }}
                  transition={{ duration: 0.6, delay: i * 0.08, ease: "easeOut" }}
                  style={{
                    position: "absolute",
                    top: "40%",
                    left: "50%",
                    color: "var(--color-accent)",
                    pointerEvents: "none",
                    display: "inline-flex",
                  }}
                  aria-hidden
                >
                  <Sparkles size={Math.max(10, size * 0.22)} strokeWidth={2} />
                </motion.span>
              );
            })}
          </AnimatePresence>
        )}
      </motion.div>
    );
  }

  let background: string = color || "var(--color-accent)";
  let filter: string | undefined;
  let animation: string | undefined;
  let backgroundSize: string | undefined;
  let opacity = 1;

  if (resolvedState === "thinking" && !reduced) {
    background =
      "linear-gradient(270deg, var(--color-accent), var(--color-accent-hover), color-mix(in srgb, var(--color-accent) 60%, white), var(--color-accent-hover), var(--color-accent))";
    backgroundSize = "300% 300%";
    animation = "horse-gradient-shift 4s ease infinite";
  } else if (resolvedState === "stealth") {
    opacity = 0.4;
    filter = "saturate(0)";
  }

  return (
    <div
      className={className}
      style={{
        ...mask,
        background,
        backgroundSize,
        animation,
        opacity,
        filter,
      }}
      {...a11y}
    />
  );
}
