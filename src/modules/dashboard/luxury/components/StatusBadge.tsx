export type StatusBadgeTone = "success" | "warning" | "critical" | "pending" | "neutral";

interface StatusBadgeProps {
  label: string;
  tone: StatusBadgeTone;
}

const TONE_CLASSES: Record<StatusBadgeTone, string> = {
  success: "bg-luxury-success/12 text-luxury-success",
  warning: "bg-luxury-warning/12 text-luxury-warning",
  critical: "bg-luxury-critical/12 text-luxury-critical",
  pending: "bg-luxury-pending/15 text-luxury-pending",
  neutral: "bg-luxury-blush text-luxury-blush-foreground",
};

/**
 * Checkpoint 19, Step 1/14 — the Luxury Dashboard's own status pill, using
 * the new distinct success/warning/critical/pending hues (unlike the
 * Classical system's single-accent-family `Badge`). Always renders a text
 * label, never color alone, so status reads correctly without color vision
 * — Step 14's own "do not use color as the only indicator of status."
 */
export function StatusBadge({ label, tone }: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-luxury-full px-2.5 py-1 text-luxury-status font-semibold tracking-wide ${TONE_CLASSES[tone]}`}>
      {label}
    </span>
  );
}
