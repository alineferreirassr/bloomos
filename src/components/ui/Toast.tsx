"use client";

import { useEffect } from "react";
import { CheckIcon, CloseIcon } from "@/components/ui/icons";

export type ToastTone = "success" | "warning" | "danger" | "info";

interface ToastProps {
  tone?: ToastTone;
  message: string;
  onDismiss: () => void;
  /** Auto-dismiss after this many ms; pass 0 to require manual dismissal. */
  autoDismissMs?: number;
}

/**
 * Checkpoint 19.2, Step 12 — four real visual tones, not nine. The spec's
 * own example list (Task Completed, Payment Received, Proposal Approved,
 * AI Suggestion, Reminder, ...) are all message CONTENT using one of these
 * four tones (mostly `success`/`info`), not distinct visual treatments —
 * inventing a separate color per named event would fragment the palette
 * for no reader-facing benefit.
 */
const toneClasses: Record<ToastTone, string> = {
  success: "border-accent/40 bg-accent-100 text-accent-800",
  warning: "border-warning/40 bg-warning/10 text-warning",
  danger: "border-danger/40 bg-danger/10 text-danger",
  info: "border-border bg-neutral-100 text-text",
};

/**
 * A transient, corner-anchored confirmation — the one non-inline
 * notification pattern in this codebase. Every other module surfaces
 * success/error state as an inline `role="alert"`/`role="status"` banner
 * next to the action that produced it; this exists because a Publish
 * success needs to outlive the dialog that closes the instant it fires.
 * `role="status"` + `aria-live="polite"` so it's announced without
 * stealing focus from wherever the user already is (the spec calls for
 * focus to return to the Publish button, not to this toast).
 */
export function Toast({ tone = "success", message, onDismiss, autoDismissMs = 5000 }: ToastProps) {
  useEffect(() => {
    if (!autoDismissMs) return;
    const timeout = setTimeout(onDismiss, autoDismissMs);
    return () => clearTimeout(timeout);
  }, [autoDismissMs, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`bloom-elevation-popover animate-toast-in fixed bottom-4 right-4 z-[var(--z-index-modal)] flex items-center gap-2 rounded-lg border px-3.5 py-2.5 text-sm ${toneClasses[tone]}`}
    >
      {tone === "success" ? <CheckIcon className="h-4 w-4 shrink-0" /> : null}
      <span>{message}</span>
      <button type="button" onClick={onDismiss} aria-label="Dismiss" className="ml-1 shrink-0 rounded p-0.5 transition-colors duration-150 hover:bg-text/10">
        <CloseIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
