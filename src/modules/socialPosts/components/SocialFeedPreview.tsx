"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { getMediaAssetDownloadUrl } from "@/lib/data";
import { SOCIAL_POST_STATUS_LABELS } from "@/core/enums/socialPostStatus";
import type { SocialPost } from "@/types/socialPost";

/**
 * SOCIAL-04D — the Instagram Feed Preview / Planner: a read-mostly grid over
 * the exact same `SocialPost[]` `SocialPostsView` already loads (SOCIAL-04A
 * Phase 16 — no duplicated canonical state, no second data model). Every
 * action here calls back into the same handlers `SocialPostsView` already
 * owns, so a successful action refreshes both views through the one existing
 * `reload()` mechanism.
 *
 * ORDERING MODEL (Phase 10/11 — stated before implementation, derived only
 * from fields that already exist on `SocialPost`):
 *
 *   1. publishing  — imminent, ordered by updated_at desc (most recently claimed first)
 *   2. scheduled   — ordered by scheduled_at ASC (soonest-to-publish sits closest to
 *                    top-left, since it becomes "newest" soonest)
 *   3. draft/failed — no confirmed feed position yet; ordered by updated_at desc
 *                    (most recently worked-on first) — grouped together since
 *                    neither has a real publish instant
 *   4. published   — ordered by published_at DESC, the real Instagram feed's own
 *                    "newest first" convention
 *
 * Top-left = the item that will appear newest in the real Instagram feed
 * soonest (an in-flight publish, then the soonest scheduled post, then
 * drafts/retries, then actual publish history newest-first) — applied
 * identically on every breakpoint, never reversed between desktop/mobile.
 */

const GROUP_ORDER: Record<SocialPost["status"], number> = {
  publishing: 0,
  scheduled: 1,
  draft: 2,
  failed: 2,
  published: 3,
};

function compareFeedPosts(a: SocialPost, b: SocialPost): number {
  const groupDiff = GROUP_ORDER[a.status] - GROUP_ORDER[b.status];
  if (groupDiff !== 0) return groupDiff;

  if (a.status === "scheduled") return (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? "");
  if (a.status === "published") return (b.published_at ?? "").localeCompare(a.published_at ?? "");
  return b.updated_at.localeCompare(a.updated_at);
}

export function orderFeedPosts(posts: SocialPost[]): SocialPost[] {
  return [...posts].sort(compareFeedPosts);
}

function formatInstant(iso: string, timezone: string | null): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: timezone ?? undefined });
}

/**
 * SOCIAL-04D Phase 5/19 — reuses the exact same `getMediaAssetDownloadUrl`
 * signed-URL mechanism every other asset preview in this codebase already
 * uses (see `AssetThumbnail.tsx`), rather than inventing a second one. A
 * post's own `asset_id` may reference an asset no longer in the composer's
 * own "currently approved" list (archived, status changed since) — this
 * resolves directly by id, and a missing/failed asset degrades to a plain
 * placeholder, never a broken-image icon or raw URL text.
 */
function FeedTileImage({ assetId, alt, className = "" }: { assetId: string; alt: string; className?: string }) {
  const [state, setState] = useState<{ forAssetId: string; url: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMediaAssetDownloadUrl(assetId).then((result) => {
      if (cancelled) return;
      setState({ forAssetId: assetId, url: result.success ? result.data.url : null });
    });
    return () => {
      cancelled = true;
    };
  }, [assetId]);

  const current = state?.forAssetId === assetId ? state : null;

  if (current?.url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- a real signed Supabase Storage URL, not a static asset Next can optimize
      <img
        src={current.url}
        alt={alt}
        onError={() => setState({ forAssetId: assetId, url: null })}
        className={`h-full w-full object-cover ${className}`}
      />
    );
  }

  return (
    <div className={`flex h-full w-full items-center justify-center bg-surface-tint text-[10px] font-medium tracking-wide text-text-muted uppercase ${className}`}>
      Image unavailable
    </div>
  );
}

const OVERLAY_LABEL: Partial<Record<SocialPost["status"], string>> = {
  draft: "Draft",
  scheduled: "Scheduled",
  publishing: "Publishing…",
  failed: "Failed",
};

/** Status is never color-only: the same text label that appears here is also read by the detail modal and by screen readers via the tile's own accessible name. Published posts render no overlay at all — deliberately quieter, since they represent actual feed history rather than a planning state. */
function FeedTileStatusOverlay({ post }: { post: SocialPost }) {
  const label = OVERLAY_LABEL[post.status];
  if (!label) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-neutral-900/60 px-1.5 py-1">
      <span className="text-[10px] font-semibold tracking-wide text-white uppercase">{label}</span>
    </div>
  );
}

function tileAccessibleName(post: SocialPost): string {
  const label = SOCIAL_POST_STATUS_LABELS[post.status];
  const caption = post.caption.trim();
  return caption ? `${label}: ${caption.slice(0, 60)}` : `${label} post`;
}

export interface SocialFeedPreviewProps {
  posts: SocialPost[];
  onCreatePost: () => void;
  onSchedule: (post: SocialPost) => void;
  onReschedule: (post: SocialPost) => void;
  onCancelSchedule: (post: SocialPost) => void;
  onPublishNow: (post: SocialPost) => void;
  publishingId: string | null;
  cancelingId: string | null;
}

/**
 * SOCIAL-04D — the grid itself. A fixed 3-column layout at every breakpoint
 * (Phase 4 — mobile keeps the recognizable Instagram grid rather than
 * collapsing to one tile per row; only the tile's own pixel size shrinks).
 */
export function SocialFeedPreview({ posts, onCreatePost, onSchedule, onReschedule, onCancelSchedule, onPublishNow, publishingId, cancelingId }: SocialFeedPreviewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const ordered = orderFeedPosts(posts);
  const selected = ordered.find((post) => post.id === selectedId) ?? null;

  if (ordered.length === 0) {
    return (
      <EmptyState
        title="Your feed preview starts here"
        description="Posts will appear here as they're drafted, scheduled, or published — laid out the way they'll actually look on Instagram."
        action={<Button onClick={onCreatePost}>Create a post</Button>}
      />
    );
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-0.5 sm:gap-1">
        {ordered.map((post) => (
          <button
            key={post.id}
            type="button"
            onClick={() => setSelectedId(post.id)}
            aria-label={tileAccessibleName(post)}
            className="focus-visible:ring-accent/40 relative aspect-square overflow-hidden bg-surface-tint focus-visible:z-10 focus-visible:ring-2 focus-visible:outline-none"
          >
            <FeedTileImage assetId={post.asset_id} alt={post.caption || "Social post image"} />
            <FeedTileStatusOverlay post={post} />
          </button>
        ))}
      </div>

      {selected ? (
        <SocialFeedPostDetail
          post={selected}
          onClose={() => setSelectedId(null)}
          onSchedule={onSchedule}
          onReschedule={onReschedule}
          onCancelSchedule={onCancelSchedule}
          onPublishNow={onPublishNow}
          publishingId={publishingId}
          cancelingId={cancelingId}
        />
      ) : null}
    </div>
  );
}

interface SocialFeedPostDetailProps {
  post: SocialPost;
  onClose: () => void;
  onSchedule: (post: SocialPost) => void;
  onReschedule: (post: SocialPost) => void;
  onCancelSchedule: (post: SocialPost) => void;
  onPublishNow: (post: SocialPost) => void;
  publishingId: string | null;
  cancelingId: string | null;
}

/**
 * SOCIAL-04D Phase 13/14 — shows exactly the fields the checkpoint
 * authorizes (image, caption, status, scheduled/published time, failure/
 * retry context, permalink) and reuses the SAME action handlers/backend
 * actions `SocialPostsView` already owns — never a second implementation of
 * schedule/reschedule/cancel/publish. `EDIT_FROM_PREVIEW` is deliberately
 * absent: no reusable "edit a draft's caption/asset" flow exists anywhere in
 * the current Social UI yet (Phase 15), so none is invented here either.
 */
function SocialFeedPostDetail({ post, onClose, onSchedule, onReschedule, onCancelSchedule, onPublishNow, publishingId, cancelingId }: SocialFeedPostDetailProps) {
  return (
    <Modal open onClose={onClose} title={SOCIAL_POST_STATUS_LABELS[post.status]}>
      <div className="flex flex-col gap-3">
        <div className="aspect-square w-full overflow-hidden rounded-lg bg-surface-tint">
          <FeedTileImage assetId={post.asset_id} alt={post.caption || "Social post image"} />
        </div>

        <Badge tone={post.status === "published" ? "success" : post.status === "failed" ? "danger" : post.status === "publishing" ? "warning" : post.status === "scheduled" ? "accent" : "neutral"}>
          {SOCIAL_POST_STATUS_LABELS[post.status]}
        </Badge>

        <p className="text-sm text-text">{post.caption || "(no caption)"}</p>

        {post.status === "scheduled" && post.scheduled_at ? <p className="text-xs text-text-muted">Scheduled for {formatInstant(post.scheduled_at, post.scheduled_timezone)}</p> : null}
        {post.status === "published" && post.published_at ? <p className="text-xs text-text-muted">Published {formatInstant(post.published_at, null)}</p> : null}
        {post.status === "failed" && post.provider_error ? (
          <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">
            {post.provider_error}
          </p>
        ) : null}
        {post.status === "failed" && post.next_attempt_at ? <p className="text-xs text-text-muted">Retry scheduled for {formatInstant(post.next_attempt_at, post.scheduled_timezone)}</p> : null}
        {post.status === "published" && post.provider_permalink ? (
          <a href={post.provider_permalink} target="_blank" rel="noopener noreferrer" className="text-xs text-accent underline">
            View on Instagram (opens in a new tab)
          </a>
        ) : null}

        <div className="mt-1 flex flex-wrap items-center gap-2">
          {(post.status === "draft" || post.status === "failed") && (
            <Button variant="secondary" onClick={() => onSchedule(post)}>
              Schedule
            </Button>
          )}
          {(post.status === "draft" || post.status === "failed" || post.status === "scheduled") && (
            <Button variant="secondary" onClick={() => onPublishNow(post)} disabled={publishingId === post.id}>
              {publishingId === post.id ? "Publishing…" : post.status === "failed" ? "Retry" : "Publish Now"}
            </Button>
          )}
          {post.status === "scheduled" && (
            <>
              <Button variant="secondary" onClick={() => onReschedule(post)} disabled={publishingId === post.id}>
                Reschedule
              </Button>
              <Button variant="secondary" onClick={() => onCancelSchedule(post)} disabled={cancelingId === post.id || publishingId === post.id}>
                {cancelingId === post.id ? "Cancelling…" : "Cancel schedule"}
              </Button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
