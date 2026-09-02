"use client";

import { useEffect, useState } from "react";
import { getCommentsForOwnerAction, createCommentAction, deleteCommentAction } from "@/modules/communication/comments/commentsActions";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import type { Comment } from "@/types/comment";
import type { EntityType } from "@/core/enums/entityType";

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; comments: Comment[] };

/** Delete is this row's one, rare/destructive action — the compact ghost treatment in the danger hue, matching the `!px-2 text-xs` precedent used for compact ghost buttons elsewhere in this module. */
const ROW_ACTION_DANGER_CLASS = "!px-2 !py-1 text-xs !text-danger hover:!bg-danger/10 active:!bg-danger/18";

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/**
 * v2.0 Checkpoint 24, Step 5/6 — the one reusable Comments Platform panel,
 * mountable on any `EntityType`'s own detail page. `@Name`/`@Team` mentions
 * are parsed server-side (`createCommentAction`) against the real
 * Workspace roster — this component just needs to render the plain-text
 * body the member typed, no client-side roster fetch required.
 */
export function CommentsPanel({ ownerType, ownerId }: { ownerType: EntityType; ownerId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchData = () => {
    getCommentsForOwnerAction(ownerType, ownerId).then((result) => {
      if (result.success) setState({ status: "ready", comments: result.data });
      else setState({ status: "error", message: result.error });
    });
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerType, ownerId]);

  async function handleSubmit() {
    if (body.trim().length === 0) return;
    setSubmitting(true);
    const result = await createCommentAction(ownerType, ownerId, body);
    setSubmitting(false);
    if (result.success) {
      setBody("");
      fetchData();
    }
  }

  async function handleDelete(id: string) {
    await deleteCommentAction(id);
    fetchData();
  }

  if (state.status === "loading") return <Skeleton className="h-32 w-full" />;
  if (state.status === "error") return <ErrorState message={state.message} onRetry={fetchData} />;

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <label htmlFor="new-comment-body" className="sr-only">
          Add a comment
        </label>
        <textarea
          id="new-comment-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a comment — use @Name or @Team to mention someone…"
          rows={3}
          className="w-full resize-none rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus-visible:border-accent focus-visible:outline-none"
        />
        <Button onClick={handleSubmit} disabled={submitting || body.trim().length === 0}>
          {submitting ? "Posting…" : "Post comment"}
        </Button>
      </div>

      {state.comments.length === 0 ? (
        <EmptyState illustration="messages" title="No comments yet" description="Be the first to leave a comment on this record." />
      ) : (
        <div className="space-y-3">
          {state.comments.map((comment) => (
            <LuxuryCard key={comment.id} className={`p-4 sm:p-5 ${comment.parent_comment_id ? "ml-4 sm:ml-6" : ""}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-text">{comment.author}</p>
                <Button type="button" variant="ghost" className={ROW_ACTION_DANGER_CLASS} onClick={() => handleDelete(comment.id)}>
                  Delete
                </Button>
              </div>
              <p className="mt-1 text-sm text-text">{comment.body}</p>
              <p className="mt-1 text-xs text-text-muted">
                {formatTimestamp(comment.created_at)}
                {comment.edited_at ? " · edited" : ""}
              </p>
            </LuxuryCard>
          ))}
        </div>
      )}
    </div>
  );
}
