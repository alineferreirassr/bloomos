"use client";

import { useEffect, useState } from "react";
import { getClientPortalJourneyDetailAction, respondToClientPortalJourneyNoteAction, type ClientPortalJourneyDetail, type ClientPortalJourneyStepStatus } from "@/modules/clientPortal/getClientPortalJourneyDetail";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; detail: ClientPortalJourneyDetail };

const STEP_STATUS_TONE: Record<ClientPortalJourneyStepStatus, BadgeTone> = {
  completed: "success",
  current: "accent",
  upcoming: "outline",
};

const STEP_STATUS_LABEL: Record<ClientPortalJourneyStepStatus, string> = {
  completed: "Completed",
  current: "Current",
  upcoming: "Upcoming",
};

/**
 * Checkpoint 36, Step 2 — the Journey Experience page. Every field comes
 * from `getClientPortalJourneyDetailAction`, itself composing the same
 * Journey/Information Request engines the dashboard's compact
 * `ClientPortalJourneyCard` (Checkpoint 32) already uses — this view only
 * renders. "Journey Notes" are the client's own Information Request
 * responses; a client may respond once, never edit the item's own
 * title/description/required fields.
 */
export function ClientPortalJourneyView() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [responseDrafts, setResponseDrafts] = useState<Record<string, string>>({});

  const fetchDetail = () =>
    getClientPortalJourneyDetailAction().then((result) => {
      if (result.success) setState({ status: "ready", detail: result.data });
      else setState({ status: "error" });
    });

  useEffect(() => {
    fetchDetail();

  }, []);

  async function handleRespond(id: string) {
    const response = responseDrafts[id]?.trim();
    if (!response) return;
    setPendingId(id);
    const result = await respondToClientPortalJourneyNoteAction(id, response);
    setPendingId(null);
    if (result.success) {
      setResponseDrafts((current) => ({ ...current, [id]: "" }));
      fetchDetail();
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl font-semibold text-text">Your Journey</h1>
      <p className="text-sm text-text-muted">Where things stand across your entire planning experience with us.</p>

      {state.status === "loading" ? (
        <div aria-live="polite" aria-busy="true">
          <Skeleton className="h-40 w-full" />
        </div>
      ) : state.status === "error" ? (
        <ErrorState message="Could not load your journey." onRetry={fetchDetail} />
      ) : (
        <>
          <Card>
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-serif text-[15px] font-semibold text-text">Progress</h2>
              <span className="text-sm text-text-muted">Currently: {state.detail.currentStageLabel}</span>
            </div>
            <div className="mt-3 space-y-2">
              <ProgressBar value={state.detail.progressPercentage} label="Overall journey progress" />
              <ProgressBar value={state.detail.currentStageProgress} label="Current stage progress" className="opacity-80" />
            </div>
          </Card>

          <Card>
            <h2 className="mb-3 font-serif text-[15px] font-semibold text-text">Journey Timeline</h2>
            <ol role="list" className="space-y-2">
              {state.detail.steps.map((step) => (
                <li key={step.stage} role="listitem" className="flex items-center justify-between gap-2 border-b border-border/60 py-1.5 last:border-none">
                  <span className={`text-sm ${step.status === "upcoming" ? "text-text-muted" : "text-text"}`}>{step.label}</span>
                  <Badge tone={STEP_STATUS_TONE[step.status]}>{STEP_STATUS_LABEL[step.status]}</Badge>
                </li>
              ))}
            </ol>
          </Card>

          <Card>
            <h2 className="mb-3 font-serif text-[15px] font-semibold text-text">Milestones</h2>
            {state.detail.milestones.length === 0 ? (
              <EmptyState title="No milestones yet" description="Milestones will appear here as your planning progresses." />
            ) : (
              <ul role="list" className="space-y-1.5">
                {state.detail.milestones.map((milestone) => (
                  <li key={milestone.label} role="listitem" className="flex items-center gap-2 text-sm">
                    <span aria-hidden="true">{milestone.completed ? "✓" : "○"}</span>
                    <span className={milestone.completed ? "text-text" : "text-text-muted"}>{milestone.label}</span>
                    {milestone.completedAt ? <span className="text-xs text-text-muted">— {new Date(milestone.completedAt).toLocaleDateString()}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="mb-1 font-serif text-[15px] font-semibold text-text">Journey Notes</h2>
            <p className="mb-3 text-xs text-text-muted">Information your planning team has asked for along the way.</p>
            {state.detail.notes.length === 0 ? (
              <EmptyState title="No notes yet" description="Requests from your planning team will appear here." />
            ) : (
              <ul role="list" className="space-y-3">
                {state.detail.notes.map((note) => (
                  <li key={note.id}>
                    <div className="rounded-md border border-border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-sm font-medium text-text">{note.title}</h3>
                        <Badge tone={note.status === "fulfilled" ? "success" : note.status === "overdue" ? "danger" : note.status === "cancelled" ? "neutral" : "warning"}>
                          {note.status === "fulfilled" ? "Answered" : note.status === "overdue" ? "Overdue" : note.status === "cancelled" ? "Cancelled" : "Pending"}
                        </Badge>
                      </div>
                      {note.description ? <p className="mt-1 text-sm text-text-muted">{note.description}</p> : null}
                      {note.clientResponse ? (
                        <p className="mt-2 text-sm text-text">
                          <span className="font-medium text-text-muted">Your response: </span>
                          {note.clientResponse}
                        </p>
                      ) : note.status === "pending" || note.status === "overdue" ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <label htmlFor={`journey-note-${note.id}`} className="sr-only">
                            Respond to {note.title}
                          </label>
                          <input
                            id={`journey-note-${note.id}`}
                            type="text"
                            placeholder="Type your response…"
                            value={responseDrafts[note.id] ?? ""}
                            onChange={(event) => setResponseDrafts((current) => ({ ...current, [note.id]: event.target.value }))}
                            className="min-w-0 flex-1 rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm text-text"
                          />
                          <Button type="button" variant="ghost" disabled={pendingId === note.id || !responseDrafts[note.id]?.trim()} onClick={() => handleRespond(note.id)}>
                            {pendingId === note.id ? "Sending…" : "Respond"}
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
