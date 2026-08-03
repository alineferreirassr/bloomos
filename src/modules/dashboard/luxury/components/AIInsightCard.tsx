import { LuxurySparklesIcon } from "@/modules/dashboard/luxury/luxuryIcons";
import { EmptyState } from "@/components/ui/EmptyState";

/** Checkpoint 19, Step 6 — the Owner Dashboard's "AI Executive Brief," reusing Checkpoint 15's real Analytics/AI Executive Summary (`generateAnalyticsExecutiveSummary`) — never a second AI summarizer. `updatedLabel` is a real relative timestamp of when that summary last ran; `null` renders the empty state instead of fabricated text. */
export function AIInsightCard({ summary, updatedLabel }: { summary: string | null; updatedLabel: string | null }) {
  if (!summary) {
    return <EmptyState title="No AI brief yet" description="Generate an Executive Summary from Analytics to see it here." />;
  }
  return (
    <div className="flex gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-luxury-md bg-luxury-blush text-luxury-rose">
        <LuxurySparklesIcon className="h-4.5 w-4.5" />
      </span>
      <div>
        <p className="text-luxury-body text-luxury-text">{summary}</p>
        {updatedLabel ? <p className="mt-1.5 text-luxury-small text-luxury-text-muted">Updated {updatedLabel}</p> : null}
      </div>
    </div>
  );
}
