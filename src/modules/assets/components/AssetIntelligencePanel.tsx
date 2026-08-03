"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  evaluateAssetAction,
  toggleAssetFavoriteAction,
  commentOnAssetAction,
  listAssetCommentsAction,
  shareAssetAction,
  downloadAssetAction,
  recordAssetViewAction,
  type AssetEvaluation,
} from "@/modules/digitalAssets/digitalAssetsActions";
import type { Comment } from "@/core/comments";
import { ASSET_HEALTH_ISSUE_LABELS, PREVIEW_TYPE_LABELS, ASSET_VISIBILITY_LABELS } from "@/types/digitalAssets";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useMemberSession } from "@/components/providers/MemberSessionProvider";

const HEALTH_BAND_TONE: Record<string, BadgeTone> = { excellent: "success", good: "success", attention: "warning", critical: "danger" };

/**
 * v2.0 Checkpoint 37, Step 18 — the Asset Detail page's own new sections:
 * Versions, Usage, Reviews, Permissions, Downloads, Health, and Comments —
 * every field sourced from `evaluateAssetAction`, itself composing this
 * checkpoint's own engines over the real `MediaAsset`. The existing
 * Overview/Metadata/Approval/Knowledge Graph sections in
 * `AssetDetailView.tsx` are untouched; this is a purely additive panel
 * rendered below them.
 */
export function AssetIntelligencePanel({ assetId }: { assetId: string }) {
  const { can } = useMemberSession();
  const [evaluation, setEvaluation] = useState<AssetEvaluation | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const canManage = can("assets.manage");

  function reload() {
    evaluateAssetAction(assetId).then((result) => setEvaluation(result.success ? result.data : null));
    listAssetCommentsAction(assetId).then((result) => setComments(result.success ? result.data : []));
  }

  useEffect(() => {
    reload();
    recordAssetViewAction(assetId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetId]);

  async function handleFavorite() {
    setBusy(true);
    await toggleAssetFavoriteAction(assetId);
    reload();
    setBusy(false);
  }

  async function handleComment() {
    if (!commentDraft.trim()) return;
    setBusy(true);
    await commentOnAssetAction(assetId, { body: commentDraft.trim() });
    setCommentDraft("");
    reload();
    setBusy(false);
  }

  async function handleShare() {
    setBusy(true);
    await shareAssetAction(assetId, "team", [], null);
    reload();
    setBusy(false);
  }

  async function handleDownload() {
    const result = await downloadAssetAction(assetId);
    if (result.success) {
      const url = URL.createObjectURL(result.data.blob);
      window.open(url, "_blank");
    }
    reload();
  }

  if (!evaluation) {
    return (
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const { health, usage, preview, permission, versions, reviews, shares, isFavorited } = evaluation;

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button variant={isFavorited ? "primary" : "secondary"} onClick={handleFavorite} disabled={busy}>
          {isFavorited ? "★ Favorited" : "☆ Favorite"}
        </Button>
        <Button variant="secondary" onClick={handleDownload}>
          Download (tracked)
        </Button>
        {canManage ? (
          <Button variant="secondary" onClick={handleShare} disabled={busy}>
            Share with Team
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Health</h2>
            <Badge tone={HEALTH_BAND_TONE[health.band]}>
              {health.score}/100 · {health.band}
            </Badge>
          </div>
          {health.issues.length === 0 ? (
            <p className="text-sm text-success">No issues found.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {health.issues.map((issue) => (
                <li key={issue.type} className="flex items-start gap-2">
                  <Badge tone="warning">{ASSET_HEALTH_ISSUE_LABELS[issue.type]}</Badge>
                  <span className="text-text-muted">{issue.detail}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-text-muted">Preview: {PREVIEW_TYPE_LABELS[preview.previewType]} {preview.canRenderInline ? "(inline-renderable)" : "(no inline preview)"}</p>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold">Where This File Is Used</h2>
          {usage.references.length === 0 ? (
            <p className="text-sm text-text-muted">This file isn&rsquo;t referenced anywhere yet.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {usage.references.map((ref, i) => (
                <li key={i} className="flex items-center gap-2">
                  <Badge tone="neutral">{ref.context}</Badge>
                  <span className="text-text-muted">{ref.label}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold">Permissions</h2>
          <p className="mb-2 text-xs text-text-muted">Visibility: {ASSET_VISIBILITY_LABELS[permission.visibility]}</p>
          <ul className="grid grid-cols-2 gap-1.5 text-sm">
            {permission.checks.map((check) => (
              <li key={check.action} className="flex items-center gap-1.5">
                <Badge tone={check.allowed ? "success" : "neutral"}>{check.allowed ? "✓" : "✕"}</Badge>
                <span className="capitalize text-text-muted">{check.action}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold">Versions</h2>
          {versions.length === 0 ? (
            <p className="text-sm text-text-muted">No version history yet.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {versions.map((version) => (
                <li key={version.id} className="flex items-center justify-between gap-2">
                  <span>v{version.version}</span>
                  <span className="text-text-muted">{new Date(version.captured_at).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold">Review History</h2>
          {reviews.length === 0 ? (
            <p className="text-sm text-text-muted">No reviews recorded yet.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {reviews.map((review) => (
                <li key={review.id}>
                  <span className="font-medium capitalize">{review.decision.replace(/_/g, " ")}</span>
                  <span className="text-text-muted"> by {review.reviewer} on {new Date(review.reviewed_at).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold">Shares</h2>
          {shares.length === 0 ? (
            <p className="text-sm text-text-muted">This file hasn&rsquo;t been shared yet.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {shares.map((share) => (
                <li key={share.id}>
                  <span className="capitalize">{share.visibility.replace(/_/g, " ")}</span>
                  <span className="text-text-muted"> by {share.shared_by} on {new Date(share.created_at).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <h2 className="mb-3 text-sm font-semibold">Comments</h2>
        <div className="mb-3 flex gap-2">
          <input
            type="text"
            value={commentDraft}
            onChange={(e) => setCommentDraft(e.target.value)}
            placeholder="Add a comment…"
            aria-label="Add a comment"
            className="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-1.5 text-sm"
          />
          <Button variant="secondary" onClick={handleComment} disabled={busy || !commentDraft.trim()}>
            Comment
          </Button>
        </div>
        {comments.length === 0 ? (
          <p className="text-sm text-text-muted">No comments yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {comments.map((comment) => (
              <li key={comment.id} className="rounded-md bg-surface-tint px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{comment.author}</span>
                  <span className="text-xs text-text-muted">{new Date(comment.created_at).toLocaleString()}</span>
                </div>
                <p className="mt-1 text-text-muted">{comment.body}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="text-xs text-text-muted">
        See the full platform picture on the{" "}
        <Link href="/assets" className="text-accent hover:underline">
          Asset Library dashboard
        </Link>
        .
      </p>
    </div>
  );
}
