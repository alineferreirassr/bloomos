import { Sparkles } from "lucide-react";
import { Card } from "@/components/ui/Card";

export type ModuleInsightTone = "info" | "success" | "warning";

interface ModuleInsightCardProps {
  /** A short, real, data-derived sentence (e.g. "5 new leads this week") — never a placeholder, never an external/LLM call. See docs/luxury-components.md. */
  insight: string;
  tone?: ModuleInsightTone;
}

const TONE_CHIP: Record<ModuleInsightTone, string> = {
  info: "bg-accent-100 text-accent",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
};

/**
 * Checkpoint 19.2, Step 6 — a small, module-level "insight" card distinct
 * from `src/modules/dashboard/luxury/components/AIInsightCard.tsx` (the
 * Owner Dashboard's own real Analytics Executive Summary surface): this one
 * never calls any AI/LLM pipeline at all — it's a plain, deterministic
 * sentence the caller computes from data it already fetched (a count, a
 * threshold check, a date comparison), styled with the same sparkle
 * language purely so it *reads* as a considered observation rather than a
 * generic banner.
 */
export function ModuleInsightCard({ insight, tone = "info" }: ModuleInsightCardProps) {
  return (
    <Card className="animate-fade-up flex items-center gap-3">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${TONE_CHIP[tone]}`}>
        <Sparkles className="h-4 w-4" aria-hidden="true" strokeWidth={2} />
      </span>
      <p className="text-sm text-text">{insight}</p>
    </Card>
  );
}
