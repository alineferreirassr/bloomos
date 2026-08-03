"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getExecutiveInsightsData } from "@/modules/analytics/insights/getExecutiveInsightsData";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import type { ExecutiveInsight, ExecutiveInsightSeverity } from "@/types/businessIntelligence";
import { EXECUTIVE_INSIGHT_CATEGORY_LABELS } from "@/types/businessIntelligence";

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; insights: ExecutiveInsight[] };

const SEVERITY_TONE: Record<ExecutiveInsightSeverity, BadgeTone> = {
  info: "neutral",
  positive: "success",
  warning: "warning",
  critical: "danger",
};

/** v2 Checkpoint 23, Step 12 — Bloom AI Executive Insights. Deterministic — see `ExecutiveInsightsEngine`. */
export function ExecutiveInsightsPanel() {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const fetchData = () =>
    getExecutiveInsightsData().then((result) => {
      if (result.success) setState({ status: "ready", insights: result.data });
      else setState({ status: "error", message: result.error });
    });

  useEffect(() => {
    fetchData();
  }, []);

  if (state.status === "loading") return <Skeleton className="h-64 w-full" />;
  if (state.status === "error") return <ErrorState message={state.message} onRetry={fetchData} />;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {state.insights.map((insight) => (
        <Card key={insight.id}>
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-text-muted">{EXECUTIVE_INSIGHT_CATEGORY_LABELS[insight.category]}</h3>
            <Badge tone={SEVERITY_TONE[insight.severity]}>{insight.severity}</Badge>
          </div>
          <p className="mt-1.5 font-serif text-base font-semibold text-text">{insight.title}</p>
          <p className="mt-1 text-sm text-text-muted">{insight.detail}</p>
          {insight.drillDown ? (
            <button type="button" className="mt-2 text-xs text-accent hover:underline" onClick={() => router.push(insight.drillDown!.href)}>
              {insight.drillDown.label} →
            </button>
          ) : null}
        </Card>
      ))}
    </div>
  );
}
