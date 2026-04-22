import { useTranslation } from "react-i18next";
import type { ErrorKind } from "../../lib/errors/ErrorKind";
import { NON_RETRYABLE } from "../../lib/errors/ErrorKind";
import State from "./State";

interface ErrorBannerProps {
  kind: ErrorKind;
  /** Retry the failing operation. Ignored for non-retryable kinds. */
  onRetry?: () => void;
  /** Dismiss the banner (maps to the secondary action). */
  onDismiss?: () => void;
  /** Deep-link action for kinds where the fix lives in Settings
   * (e.g., provider-401 invalid API key). */
  onOpenSettings?: () => void;
  /** Compact row layout for inline error placement. */
  inline?: boolean;
}

/**
 * Canonical inline error surface. Maps an `ErrorKind` to copy via i18n
 * (`errors.{kind}.title|body|primary|secondary`) and wires the right
 * action based on retryability and kind semantics.
 */
export default function ErrorBanner({
  kind,
  onRetry,
  onDismiss,
  onOpenSettings,
  inline,
}: ErrorBannerProps) {
  const { t } = useTranslation("errors");

  const title = t(`${kind}.title`, { defaultValue: t("unknown.title") });
  const body = t(`${kind}.body`, { defaultValue: t("unknown.body") });
  const primaryLabel = t(`${kind}.primary`, { defaultValue: "" });
  const secondaryLabel = t(`${kind}.secondary`, { defaultValue: "" });

  const canRetry = !NON_RETRYABLE.has(kind) && typeof onRetry === "function";
  const opensSettings =
    kind === "provider-401" && typeof onOpenSettings === "function";

  const primary = canRetry
    ? {
        label: primaryLabel || t("unknown.primary"),
        onClick: onRetry as () => void,
      }
    : opensSettings
      ? {
          label: primaryLabel || t("unknown.primary"),
          onClick: onOpenSettings as () => void,
        }
      : undefined;

  const secondary =
    onDismiss && secondaryLabel
      ? { label: secondaryLabel, onClick: onDismiss }
      : undefined;

  return (
    <State
      variant="error"
      title={title}
      body={body}
      inline={inline}
      action={primary}
      secondary={secondary}
    />
  );
}
