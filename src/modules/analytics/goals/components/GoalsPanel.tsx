"use client";

import { useEffect, useState } from "react";
import { listGoalsProgressAction, setGoalAction, deleteGoalAction } from "@/modules/analytics/goals/goalsActions";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { formatMoney } from "@/lib/money";
import { GOAL_METRICS, GOAL_METRIC_LABELS, type GoalProgress } from "@/types/businessIntelligence";

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; goals: GoalProgress[] };

function isMoneyMetric(metric: string): boolean {
  return metric === "monthlyRevenue" || metric === "quarterlyRevenue" || metric === "annualRevenue" || metric === "profit";
}

function formatValue(metric: string, value: number | null): string {
  if (value === null) return "—";
  if (isMoneyMetric(metric)) return formatMoney(value, "USD");
  if (metric === "conversionRate" || metric === "customerSatisfaction") return `${value.toFixed(1)}%`;
  return value.toLocaleString();
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function endOfMonthIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
}

/** v2 Checkpoint 23, Step 9 — Goals & Targets. */
export function GoalsPanel() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [metric, setMetric] = useState<(typeof GOAL_METRICS)[number]>("monthlyRevenue");
  const [periodStart, setPeriodStart] = useState(todayIso());
  const [periodEnd, setPeriodEnd] = useState(endOfMonthIso());
  const [targetValue, setTargetValue] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const fetchData = () =>
    listGoalsProgressAction().then((result) => {
      if (result.success) setState({ status: "ready", goals: result.data });
      else setState({ status: "error", message: result.error });
    });

  useEffect(() => {
    fetchData();
  }, []);

  async function handleCreate() {
    setFormError(null);
    const parsedTarget = Number(targetValue);
    if (!Number.isFinite(parsedTarget)) {
      setFormError("Enter a real number for the target.");
      return;
    }
    const result = await setGoalAction({
      metric,
      periodStart: new Date(periodStart).toISOString(),
      periodEnd: new Date(periodEnd).toISOString(),
      targetValue: isMoneyMetric(metric) ? Math.round(parsedTarget * 100) : parsedTarget,
    });
    if (!result.success) {
      setFormError(result.error);
      return;
    }
    setTargetValue("");
    fetchData();
  }

  async function handleDelete(goalId: string) {
    await deleteGoalAction(goalId);
    fetchData();
  }

  if (state.status === "loading") return <Skeleton className="h-64 w-full" />;
  if (state.status === "error") return <ErrorState message={state.message} onRetry={fetchData} />;

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="font-serif text-[17px] font-semibold text-text">Set a New Goal</h3>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FormField label="Metric" htmlFor="goal-metric">
            <Select id="goal-metric" value={metric} onChange={(e) => setMetric(e.target.value as (typeof GOAL_METRICS)[number])}>
              {GOAL_METRICS.map((m) => (
                <option key={m} value={m}>
                  {GOAL_METRIC_LABELS[m]}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Period start" htmlFor="goal-period-start">
            <Input id="goal-period-start" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
          </FormField>
          <FormField label="Period end" htmlFor="goal-period-end">
            <Input id="goal-period-end" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
          </FormField>
          <FormField label={isMoneyMetric(metric) ? "Target ($)" : "Target"} htmlFor="goal-target" error={formError ?? undefined}>
            <Input id="goal-target" type="number" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} placeholder={isMoneyMetric(metric) ? "10000" : "10"} />
          </FormField>
        </div>
        <Button className="mt-3" onClick={handleCreate}>
          Set Goal
        </Button>
      </Card>

      {state.goals.length === 0 ? (
        <EmptyState title="No goals set yet" description="Set a Monthly Revenue, Events, or Conversion Rate target above to track progress here." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {state.goals.map((progress) => (
            <Card key={progress.goal.id}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-medium text-text">{GOAL_METRIC_LABELS[progress.goal.metric]}</h3>
                  <p className="text-xs text-text-muted">
                    {progress.goal.period_start.slice(0, 10)} – {progress.goal.period_end.slice(0, 10)}
                  </p>
                </div>
                {progress.onTrack !== null ? <Badge tone={progress.onTrack ? "success" : "warning"}>{progress.onTrack ? "On track" : "Behind"}</Badge> : null}
              </div>
              <p className="mt-2 font-serif text-xl font-semibold text-text tabular-nums">
                {formatValue(progress.goal.metric, progress.currentValue)}
                <span className="text-sm font-normal text-text-muted"> / {formatValue(progress.goal.metric, progress.goal.target_value)}</span>
              </p>
              {progress.progressPercent === null ? (
                <p className="mt-2 text-xs text-text-muted">No data source for this metric yet.</p>
              ) : (
                <div
                  className="mt-2 h-2 overflow-hidden rounded-full bg-surface-hover"
                  role="progressbar"
                  aria-valuenow={Math.round(Math.min(100, Math.max(0, progress.progressPercent)))}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${GOAL_METRIC_LABELS[progress.goal.metric]} progress`}
                >
                  <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, Math.max(0, progress.progressPercent))}%` }} />
                </div>
              )}
              <button type="button" className="mt-3 text-xs text-danger hover:underline" onClick={() => handleDelete(progress.goal.id)}>
                Remove
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
