"use client";

import { useEffect, useState } from "react";
import { getCommentsForOwnerAction, createCommentAction, deleteCommentAction } from "@/modules/communication/comments/commentsActions";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import type { Comment } from "@/types/comment";
import type { EntityType } from "@/core/enums/entityType";

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; comments: Comment[] };

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
        <EmptyState title="No comments yet" description="Be the first to leave a comment on this record." />
      ) : (
        <ul className="space-y-2">
          {state.comments.map((comment) => (
            <li key={comment.id} className={`rounded-md border border-border/60 p-3 ${comment.parent_comment_id ? "ml-6" : ""}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-text">{comment.author}</p>
                <button type="button" className="text-xs text-danger hover:underline" onClick={() => handleDelete(comment.id)}>
                  Delete
                </button>
              </div>
              <p className="mt-1 text-sm text-text">{comment.body}</p>
              <p className="mt-1 text-xs text-text-muted">
                {formatTimestamp(comment.created_at)}
                {comment.edited_at ? " · edited" : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
