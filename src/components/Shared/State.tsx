import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { AlertCircle } from "lucide-react";
import HorseLogo from "./HorseLogo";

export type StateVariant = "empty" | "loading" | "error" | "locked";

export interface StateAction {
  label: string;
  onClick: () => void;
}

export interface StateProps {
  variant: StateVariant;
  title: string;
  body?: string;
  /** Override the default icon for this variant. Pass `null` to
   * suppress the icon entirely — useful in secondary regions
   * (sidebar, drawer) where the HorseLogo would duplicate the
   * primary brand moment. */
  icon?: ReactNode | null;
  action?: StateAction;
  secondary?: StateAction;
  /** Compact row layout for inline use (sidebar, list headers). */
  inline?: boolean;
  className?: string;
}

interface VariantMeta {
  role: "status" | "alert" | "region";
  live?: "polite" | "assertive";
  aria?: Record<string, string | boolean>;
  defaultIcon: (reduced: boolean, size: number) => ReactNode;
}

const VARIANT_META: Record<StateVariant, VariantMeta> = {
  empty: {
    role: "status",
    live: "polite",
    defaultIcon: (_r, size) => <HorseLogo state="idle" size={size} />,
  },
  loading: {
    role: "status",
    aria: { "aria-busy": true },
    defaultIcon: (reduced, size) =>
      reduced ? (
        <div
          aria-hidden
          style={{
            width: size,
            height: size,
            borderRadius: "var(--radius-md, 10px)",
            background: "var(--surface-tertiary)",
          }}
        />
      ) : (
        <HorseLogo state="thinking" size={size} />
      ),
  },
  error: {
    role: "alert",
    live: "assertive",
    defaultIcon: (_r, size) => (
      <AlertCircle
        size={Math.round(size * 0.7)}
        strokeWidth={1.75}
        color="var(--color-error, var(--color-accent))"
        aria-hidden
      />
    ),
  },
  locked: {
    role: "region",
    aria: { "aria-label": "Tier bloqueado" },
    defaultIcon: (_r, size) => <HorseLogo state="stealth" size={size} />,
  },
};

export default function State({
  variant,
  title,
  body,
  icon,
  action,
  secondary,
  inline = false,
  className,
}: StateProps) {
  const reduced = useReducedMotion() ?? false;
  const meta = VARIANT_META[variant];
  const iconSize = inline ? 28 : variant === "error" ? 40 : 56;
  // `icon === undefined` → use the variant default.
  // `icon === null`      → suppress icon entirely (no wrapper div).
  // `icon` is a node     → render as given.
  const resolvedIcon =
    icon === undefined ? meta.defaultIcon(reduced, iconSize) : icon;

  const wrapperStyle: React.CSSProperties = inline
    ? {
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: "8px 12px",
        textAlign: "left",
      }
    : {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
        padding: "48px 24px",
        textAlign: "center",
        maxWidth: 360,
        margin: "0 auto",
      };

  const contentStyle: React.CSSProperties = inline
    ? { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }
    : { display: "flex", flexDirection: "column", alignItems: "center", gap: 6 };

  const titleStyle: React.CSSProperties = {
    color: "var(--text-primary)",
    fontSize: inline ? 13 : 17,
    fontWeight: 600,
    letterSpacing: -0.2,
    margin: 0,
  };

  const bodyStyle: React.CSSProperties = {
    color: "var(--text-muted)",
    fontSize: inline ? 12 : 13,
    lineHeight: 1.5,
    margin: 0,
    maxWidth: inline ? undefined : 300,
    display: "-webkit-box",
    WebkitLineClamp: inline ? 1 : 3,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  };

  const actionsStyle: React.CSSProperties = {
    display: "flex",
    gap: 8,
    marginTop: inline ? 0 : 8,
  };

  const buttonBase: React.CSSProperties = {
    fontSize: 12.5,
    fontWeight: 500,
    padding: "6px 14px",
    borderRadius: "var(--radius-sm, 6px)",
    cursor: "pointer",
    fontFamily: "inherit",
  };

  return (
    <motion.div
      className={className}
      role={meta.role}
      aria-live={meta.live}
      {...(meta.aria ?? {})}
      style={wrapperStyle}
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
    >
      {resolvedIcon !== null && (
        <div style={{ flexShrink: 0, display: "inline-flex" }}>
          {resolvedIcon}
        </div>
      )}

      <div style={contentStyle}>
        <h2 style={titleStyle}>{title}</h2>
        {body && <p style={bodyStyle}>{body}</p>}

        {(action || secondary) && (
          <div style={actionsStyle}>
            {action && (
              <button
                type="button"
                onClick={action.onClick}
                style={{
                  ...buttonBase,
                  background: "var(--color-accent)",
                  color: "var(--text-on-accent, #fff)",
                  border: "1px solid transparent",
                }}
              >
                {action.label}
              </button>
            )}
            {secondary && (
              <button
                type="button"
                onClick={secondary.onClick}
                style={{
                  ...buttonBase,
                  background: "transparent",
                  color: "var(--color-accent)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                {secondary.label}
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
