"use client";

import { useState } from "react";
import { generateAnalyticsExecutiveSummary } from "@/modules/analytics/generateAnalyticsExecutiveSummary";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { AnalyticsExecutiveSummaryModelOutput } from "@/modules/analytics/aiSummary/types";
import type { TrendWindowKey } from "@/types/analytics";

type State = { status: "idle" } | { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: AnalyticsExecutiveSummaryModelOutput };

/**
 * Step 6's own AI Analytics surface — never auto-generated on page load
 * (an explicit "Generate Summary" click, the same human-in-the-loop
 * posture every other Bloom AI Brief/Assistant already uses), and always
 * a narration of the Overview tab's own already-computed metrics, never a
 * new calculation.
 */
export function AnalyticsExecutiveSummaryCard({ windowKey }: { windowKey: TrendWindowKey }) {
  const [state, setState] = useState<State>({ status: "idle" });

  async function handleGenerate() {
    setState({ status: "loading" });
    const result = await generateAnalyticsExecutiveSummary(windowKey);
    setState(result.success ? { status: "ready", data: result.data } : { status: "error", message: result.error });
  }

  return (
    <Card className="border-accent/30 bg-accent/5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-serif text-[15px] font-semibold text-text">Executive Summary</h2>
        <Button type="button" variant="secondary" onClick={handleGenerate} disabled={state.status === "loading"}>
          {state.status === "loading" ? "Generating…" : state.status === "ready" ? "Regenerate" : "Generate Summary"}
        </Button>
      </div>

      <div aria-live="polite" className="mt-3">
        {state.status === "idle" ? (
          <p className="text-sm text-text-muted">Ask Bloom AI to narrate this window&rsquo;s metrics — a summary, risks, highlights, and recommendations. Never a new calculation.</p>
        ) : state.status === "loading" ? (
          <p className="text-sm text-text-muted" aria-busy="true">
            Reading this window&rsquo;s metrics…
          </p>
        ) : state.status === "error" ? (
          <p role="alert" className="text-sm text-danger">
            {state.message}
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-text">{state.data.executiveSummary}</p>
            {state.data.performanceHighlights.length > 0 ? (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Performance Highlights</p>
                <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm text-text">
                  {state.data.performanceHighlights.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {state.data.operationalRisks.length > 0 ? (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Operational Risks</p>
                <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm text-text">
                  {state.data.operationalRisks.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {state.data.recommendations.length > 0 ? (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Recommendations</p>
                <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm text-text">
                  {state.data.recommendations.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </Card>
  );
}
