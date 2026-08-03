"use client";

import { useState } from "react";
import { useEffect } from "react";
import { getClientPortalChecklist, completeClientPortalChecklistItem, commentOnClientPortalChecklistItem, logClientPortalActivityForCurrentSession } from "@/lib/data";
import { dispatchChecklistItemCompletedTrigger } from "@/modules/clientPortal/dispatchClientPortalTriggerActions";
import type { ClientPortalChecklistItem } from "@/types/clientPortalChecklist";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; items: ClientPortalChecklistItem[] };

const STATUS_TONE: Record<ClientPortalChecklistItem["status"], BadgeTone> = {
  pending: "outline",
  in_progress: "warning",
  blocked: "danger",
  completed: "success",
  cancelled: "neutral",
};

const STATUS_LABEL: Record<ClientPortalChecklistItem["status"], string> = {
  pending: "Pending",
  in_progress: "In Progress",
  blocked: "Blocked",
  completed: "Completed",
  cancelled: "Cancelled",
};

/** Step 7's own client-facing Checklist — only items a staff member has explicitly marked `client_visible` ever appear here (see `clientPortalChecklistService.ts`); a client may Complete or Comment, never edit the item's own title/description. "Upload attachment" is an inert, explicitly-disabled control per this checkpoint's own "placeholder" wording — not a working feature yet. */
export function ClientPortalChecklistView() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});

  const fetchChecklist = () =>
    getClientPortalChecklist()
      .then((items) => setState({ status: "ready", items }))
      .catch(() => setState({ status: "error" }));

  useEffect(() => {
    fetchChecklist();

  }, []);

  async function handleComplete(id: string) {
    setPendingId(id);
    const result = await completeClientPortalChecklistItem(id);
    setPendingId(null);
    if (result.success) {
      logClientPortalActivityForCurrentSession("checklist_item_completed", id, result.data.title);
      dispatchChecklistItemCompletedTrigger(id, result.data.title);
      fetchChecklist();
    }
  }

  async function handleComment(id: string) {
    const comment = commentDrafts[id]?.trim();
    if (!comment) return;
    setPendingId(id);
    const result = await commentOnClientPortalChecklistItem(id, comment);
    setPendingId(null);
    if (result.success) {
      setCommentDrafts((current) => ({ ...current, [id]: "" }));
      fetchChecklist();
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl font-semibold text-text">Checklist</h1>
      <p className="text-sm text-text-muted">Steps we&rsquo;re tracking together for your event.</p>

      {state.status === "loading" ? (
        <div aria-live="polite" aria-busy="true">
          <Skeleton className="h-40 w-full" />
        </div>
      ) : state.status === "error" ? (
        <ErrorState message="Could not load your checklist." onRetry={fetchChecklist} />
      ) : state.items.length === 0 ? (
        <EmptyState title="Nothing shared yet" description="Checklist items your planner shares with you will appear here." />
      ) : (
        <ul className="space-y-3">
          {state.items.map((item) => (
            <li key={item.id}>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-serif text-[15px] font-semibold text-text">{item.title}</h3>
                      <Badge tone={STATUS_TONE[item.status]}>{STATUS_LABEL[item.status]}</Badge>
                    </div>
                    {item.description ? <p className="mt-1 text-sm text-text-muted">{item.description}</p> : null}
                    {item.due_date ? <p className="mt-1 text-xs text-text-muted">Due {new Date(item.due_date).toLocaleDateString()}</p> : null}
                  </div>
                  {item.status !== "completed" ? (
                    <Button type="button" variant="secondary" disabled={pendingId === item.id} onClick={() => handleComplete(item.id)}>
                      {pendingId === item.id ? "Marking…" : "Mark Complete"}
                    </Button>
                  ) : null}
                </div>

                <div className="mt-3 space-y-2 border-t border-border pt-3">
                  {item.client_comment ? (
                    <p className="text-sm text-text">
                      <span className="font-medium text-text-muted">Your comment: </span>
                      {item.client_comment}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2">
                    <label htmlFor={`comment-${item.id}`} className="sr-only">
                      Comment on {item.title}
                    </label>
                    <input
                      id={`comment-${item.id}`}
                      type="text"
                      placeholder="Add a comment…"
                      value={commentDrafts[item.id] ?? ""}
                      onChange={(event) => setCommentDrafts((current) => ({ ...current, [item.id]: event.target.value }))}
                      className="min-w-0 flex-1 rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm text-text"
                    />
                    <Button type="button" variant="ghost" disabled={pendingId === item.id || !commentDrafts[item.id]?.trim()} onClick={() => handleComment(item.id)}>
                      Comment
                    </Button>
                    <Button type="button" variant="ghost" disabled title="Attachments aren't available yet">
                      Upload Attachment
                    </Button>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
