"use client";

import { useEffect, useState } from "react";
import { getClientPortalOnboardingAction, type ClientPortalOnboarding } from "@/modules/clientPortal/getClientPortalOnboarding";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { TaskChecklist, type TaskChecklistItemData } from "@/modules/dashboard/luxury/components/TaskChecklist";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; onboarding: ClientPortalOnboarding };

/**
 * v2 Checkpoint 44, Step 10 — Client Onboarding. Every field comes from
 * `getClientPortalOnboardingAction()`, itself a narrow projection of the
 * same `buildClientJourney()` the Journey Experience page
 * (`ClientPortalJourneyView.tsx`) already renders — this is a second,
 * onboarding-scoped *view* of that one Journey, never a second Journey
 * engine. Reuses `ProgressBar` (the same primitive the Journey page
 * renders) and `TaskChecklist` (Checkpoint 19's own shared checkbox-list,
 * rendered here read-only — a Client can't self-toggle a Journey
 * Requirement, only a real record change satisfies one).
 */
export function ClientPortalOnboardingView() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    getClientPortalOnboardingAction().then((result) => {
      if (result.success) setState({ status: "ready", onboarding: result.data });
      else setState({ status: "error" });
    });
  }, []);

  if (state.status === "loading") {
    return (
      <div aria-live="polite" aria-busy="true">
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (state.status === "error") {
    return <ErrorState message="Could not load your onboarding checklist." onRetry={() => setState({ status: "loading" })} />;
  }

  const { onboarding } = state;

  if (!onboarding.inOnboarding) {
    return (
      <EmptyState
        title="You&rsquo;re all set here"
        description={`Your onboarding is complete — you're currently at "${onboarding.currentStageLabel}". See "My Journey" for your full planning timeline.`}
      />
    );
  }

  const checklistItems: TaskChecklistItemData[] = onboarding.checklist.map((item) => ({
    id: item.id,
    title: item.title,
    timeLabel: item.detail,
    completed: item.completed,
  }));

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl font-semibold text-text">Welcome</h1>
      <p className="text-sm text-text-muted">Here&rsquo;s what&rsquo;s happening as we get you set up.</p>

      <Card>
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-serif text-[15px] font-semibold text-text">Getting Started</h2>
          <span className="text-sm text-text-muted">Currently: {onboarding.currentStageLabel}</span>
        </div>
        <div className="mt-3 space-y-2">
          <ProgressBar value={onboarding.progressPercentage} label="Overall journey progress" />
          <ProgressBar value={onboarding.currentStageProgress} label="Current stage progress" className="opacity-80" />
        </div>
        {onboarding.nextStepLabel ? <p className="mt-3 text-sm text-text">Next up: {onboarding.nextStepLabel}</p> : null}
      </Card>

      <Card>
        <h2 className="mb-3 font-serif text-[15px] font-semibold text-text">Onboarding Checklist</h2>
        {checklistItems.length === 0 ? (
          <EmptyState title="Nothing outstanding" description="Every onboarding item for this stage is complete." />
        ) : (
          <TaskChecklist items={checklistItems} />
        )}
      </Card>
    </div>
  );
}
