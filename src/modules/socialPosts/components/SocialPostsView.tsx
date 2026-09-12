"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  listSocialPostsAction,
  createSocialPostAction,
  publishSocialPostNowAction,
  scheduleSocialPostAction,
  rescheduleSocialPostAction,
  cancelSocialPostScheduleAction,
  listSocialMediaAssetsAction,
  getSocialPostInsightsAction,
  type SocialPostInsights,
} from "@/modules/socialPosts/socialPostActions";
import { getSelectedMetaPublishingIdentityAction, type MetaSelectedIdentity } from "@/modules/integrations/meta/metaAccountActions";
import { getMediaAssetDownloadUrl } from "@/lib/data";
import { SOCIAL_POST_STATUS_LABELS, type SocialPostStatus } from "@/core/enums/socialPostStatus";
import { SocialScheduleDialog, type ScheduleSubmitInput } from "@/modules/socialPosts/components/SocialScheduleDialog";
import type { SocialPost } from "@/types/socialPost";
import type { MediaAsset } from "@/types/mediaAsset";

/** SOCIAL-05B — label + display order for the metrics `getSocialPostInsightsAction` may return. A key absent from the fetched result is never rendered — it means Meta didn't return a value for it (most commonly: too soon after publishing), not a real zero. */
const INSIGHT_METRIC_LABELS: Array<{ key: keyof SocialPostInsights["metrics"]; label: string }> = [
  { key: "views", label: "Views" },
  { key: "reach", label: "Reach" },
  { key: "likes", label: "Likes" },
  { key: "comments", label: "Comments" },
  { key: "shares", label: "Shares" },
  { key: "saved", label: "Saved" },
  { key: "total_interactions", label: "Interactions" },
];

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready" };

const STATUS_TONE: Record<SocialPostStatus, BadgeTone> = {
  draft: "neutral",
  scheduled: "accent",
  publishing: "warning",
  published: "success",
  failed: "danger",
};

interface PanelData {
  posts: SocialPost[];
  identity: MetaSelectedIdentity | null;
  images: MediaAsset[];
}

/**
 * Pure, module-level fetcher — no closure over component state setters —
 * mirrors `MetaSettingsPanel.tsx`'s own established split so the mount
 * effect never trips `react-hooks/set-state-in-effect`.
 *
 * SOCIAL-LIVE-01B — asset loading now goes through `listSocialMediaAssetsAction`
 * (session-derived workspace id, resolved entirely server-side — this
 * component never sees or supplies a workspace id) instead of the removed
 * `listMediaAssetsForWorkspace(CURRENT_WORKSPACE_ID)` call, which sent a
 * mock-mode placeholder string into a live `uuid` column and threw a raw,
 * uncaught 400. The whole body is also now wrapped in try/catch: every
 * individual action already returns a `Result` and never throws, but this
 * is the one place that guards against ANY future rejection (a change to
 * one of the three actions, a transient framework-level throw) leaving the
 * panel stuck in `{status: "loading"}` forever instead of reaching the
 * existing controlled `ErrorState`.
 */
async function fetchPanelData(): Promise<PanelData | null> {
  try {
    const [postsResult, identityResult, assetsResult] = await Promise.all([
      listSocialPostsAction(),
      getSelectedMetaPublishingIdentityAction(),
      listSocialMediaAssetsAction(),
    ]);
    if (!postsResult.success) return null;

    return {
      posts: postsResult.data,
      identity: identityResult.success ? identityResult.data : null,
      images: assetsResult.success ? assetsResult.data : [],
    };
  } catch {
    return null;
  }
}

function assetLabel(asset: MediaAsset): string {
  return asset.original_filename;
}

/** SOCIAL-04C — never a raw ISO string: a humanized date/time, rendered back in the timezone the post was actually scheduled for (never the current browser timezone, which may differ from that). No precision-guarantee language — the real scheduler cadence isn't platform-verified (SOCIAL-04B's own honest disclosure). */
function formatScheduledInstant(iso: string, timezone: string | null): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: timezone ?? undefined });
}

type ScheduleDialogState = { kind: "new" } | { kind: "schedule"; post: SocialPost } | { kind: "reschedule"; post: SocialPost };

/**
 * SOCIAL-03 — the smallest useful Social UI: a list of real, persisted
 * Social Posts plus an inline Create Post panel (caption + an Asset
 * Picker reusing the existing, real Assets domain — no parallel upload
 * system, no scheduling controls, no analytics).
 */
export function SocialPostsView() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [identity, setIdentity] = useState<MetaSelectedIdentity | null>(null);
  const [images, setImages] = useState<MediaAsset[]>([]);
  const [caption, setCaption] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<{ id: string; message: string } | null>(null);
  const [insightsById, setInsightsById] = useState<Record<string, SocialPostInsights>>({});
  const [insightsLoadingId, setInsightsLoadingId] = useState<string | null>(null);
  const [insightsError, setInsightsError] = useState<{ id: string; message: string } | null>(null);
  const [scheduleDialog, setScheduleDialog] = useState<ScheduleDialogState | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ id: string; message: string } | null>(null);

  function applyPanelData(data: PanelData | null) {
    if (!data) {
      setState({ status: "error" });
      return;
    }
    setPosts(data.posts);
    setIdentity(data.identity);
    setImages(data.images);
    setState({ status: "ready" });
  }

  function reload() {
    fetchPanelData().then(applyPanelData);
  }

  useEffect(() => {
    fetchPanelData().then(applyPanelData);
  }, []);

  // Best-effort thumbnails — a signed URL per visible image, never blocking the rest of the page if one fails.
  useEffect(() => {
    let cancelled = false;
    images.forEach((asset) => {
      if (thumbnailUrls[asset.id]) return;
      getMediaAssetDownloadUrl(asset.id, 300).then((result) => {
        if (cancelled || !result.success) return;
        setThumbnailUrls((prev) => ({ ...prev, [asset.id]: result.data.url }));
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images]);

  async function handleCreate(publishImmediately: boolean) {
    if (!selectedAssetId) {
      setFormError("Select an image to publish.");
      return;
    }
    setBusy(true);
    setFormError(null);
    const created = await createSocialPostAction({ caption, assetId: selectedAssetId });
    if (!created.success) {
      setBusy(false);
      setFormError(created.error);
      return;
    }

    if (publishImmediately) {
      const published = await publishSocialPostNowAction(created.data.id);
      setBusy(false);
      if (!published.success) setFormError(published.error);
    } else {
      setBusy(false);
    }

    setCaption("");
    setSelectedAssetId(null);
    reload();
  }

  async function handlePublish(post: SocialPost) {
    setPublishingId(post.id);
    setPublishError(null);
    const result = await publishSocialPostNowAction(post.id);
    setPublishingId(null);
    if (!result.success) setPublishError({ id: post.id, message: result.error });
    reload();
  }

  /**
   * SOCIAL-04C — the one submit handler behind every dialog opening
   * (`new`/`schedule`/`reschedule`), matching Phase 3's "use the existing
   * composer, never a second one" requirement: scheduling a brand-new post
   * is still exactly one `createSocialPostAction` call, immediately
   * followed by `scheduleSocialPostAction` — never a separate creation
   * flow. The dialog itself owns date/time/timezone collection and
   * future-time validation; this only ever forwards an already-validated
   * UTC instant + IANA timezone to the real backend action, which remains
   * the authoritative validator.
   */
  async function handleScheduleSubmit(input: ScheduleSubmitInput): Promise<{ success: boolean; error?: string }> {
    if (!scheduleDialog) return { success: false, error: "Something went wrong. Please try again." };

    if (scheduleDialog.kind === "new") {
      if (!selectedAssetId) return { success: false, error: "Select an image to publish." };
      const created = await createSocialPostAction({ caption, assetId: selectedAssetId });
      if (!created.success) return { success: false, error: created.error };
      const scheduled = await scheduleSocialPostAction(created.data.id, input);
      if (!scheduled.success) return { success: false, error: scheduled.error };
      setCaption("");
      setSelectedAssetId(null);
      reload();
      return { success: true };
    }

    const action = scheduleDialog.kind === "schedule" ? scheduleSocialPostAction : rescheduleSocialPostAction;
    const result = await action(scheduleDialog.post.id, input);
    if (!result.success) return { success: false, error: result.error };
    reload();
    return { success: true };
  }

  async function handleCancelSchedule(post: SocialPost) {
    if (!window.confirm("Cancel this scheduled post? It will return to Draft — your caption and image stay exactly as they are.")) return;
    setCancelingId(post.id);
    setActionError(null);
    const result = await cancelSocialPostScheduleAction(post.id);
    setCancelingId(null);
    if (!result.success) setActionError({ id: post.id, message: result.error });
    reload();
  }

  /** SOCIAL-05B — manual, on-demand, one post at a time. Never fetched automatically for every published post on load, and never batched across posts — a fresh request only when this specific button is clicked. */
  async function handleFetchInsights(post: SocialPost) {
    setInsightsLoadingId(post.id);
    setInsightsError(null);
    const result = await getSocialPostInsightsAction(post.id);
    setInsightsLoadingId(null);
    if (!result.success) {
      setInsightsError({ id: post.id, message: result.error });
      return;
    }
    setInsightsById((prev) => ({ ...prev, [post.id]: result.data }));
  }

  if (state.status === "loading") {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-9 w-full max-w-xs" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (state.status === "error") {
    return <ErrorState message="Could not load Social Posts." onRetry={reload} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Social" subtitle="Publish Instagram posts using Amoré Bloom's connected Meta account." />

      {!identity ? (
        <Card>
          <p className="text-sm text-text-muted">
            No Instagram publishing identity is selected yet.{" "}
            <a href="/settings/integrations/meta" className="text-accent underline">
              Connect Meta and select a Page
            </a>{" "}
            before creating a post.
          </p>
        </Card>
      ) : (
        <Card>
          <h3 className="font-serif text-[17px] font-semibold text-text">New Post</h3>
          <p className="mt-1 text-xs text-text-muted">Publishing to Instagram: @{identity.instagramUsername ?? identity.instagramAccountId}</p>

          <div className="mt-3">
            <span className="mb-1.5 block text-xs font-medium text-text-muted">Caption</span>
            <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={2200} placeholder="Write a caption…" />
          </div>

          <div className="mt-3">
            <span className="mb-1.5 block text-xs font-medium text-text-muted">Image</span>
            {images.length === 0 ? (
              <p className="text-sm text-text-muted">No approved JPEG images are available. Approve an image in Assets first — Instagram requires a JPEG.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {images.map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => setSelectedAssetId(asset.id)}
                    aria-pressed={selectedAssetId === asset.id}
                    title={assetLabel(asset)}
                    className={`h-20 w-20 overflow-hidden rounded-lg border-2 ${selectedAssetId === asset.id ? "border-accent" : "border-border"}`}
                  >
                    {thumbnailUrls[asset.id] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumbnailUrls[asset.id]} alt={assetLabel(asset)} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-surface-muted text-xs text-text-muted">…</div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {formError ? (
            <p role="alert" className="mt-3 text-sm text-rose-600 dark:text-rose-400">
              {formError}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={() => handleCreate(false)} disabled={busy || !selectedAssetId}>
              {busy ? "Saving…" : "Save Draft"}
            </Button>
            <Button variant="secondary" onClick={() => setScheduleDialog({ kind: "new" })} disabled={busy || !selectedAssetId}>
              Schedule
            </Button>
            <Button onClick={() => handleCreate(true)} disabled={busy || !selectedAssetId}>
              {busy ? "Publishing…" : "Publish Now"}
            </Button>
          </div>
        </Card>
      )}

      <Card>
        <h3 className="font-serif text-[17px] font-semibold text-text">Posts</h3>
        {posts.length === 0 ? (
          <p className="mt-3 text-sm text-text-muted">No social posts yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {posts.map((post) => (
              <li key={post.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge tone={STATUS_TONE[post.status]}>{SOCIAL_POST_STATUS_LABELS[post.status]}</Badge>
                    <span className="text-xs text-text-muted">{new Date(post.created_at).toLocaleString()}</span>
                  </div>
                  <p className="mt-1 truncate text-sm text-text">{post.caption || "(no caption)"}</p>
                  {post.status === "scheduled" && post.scheduled_at ? (
                    <p className="mt-1 text-xs text-text-muted">Scheduled for {formatScheduledInstant(post.scheduled_at, post.scheduled_timezone)}</p>
                  ) : null}
                  {post.status === "failed" && post.provider_error ? (
                    <p role="alert" className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                      {post.provider_error}
                    </p>
                  ) : null}
                  {post.status === "failed" && post.next_attempt_at ? (
                    <p className="mt-1 text-xs text-text-muted">Retry scheduled for {formatScheduledInstant(post.next_attempt_at, post.scheduled_timezone)}</p>
                  ) : null}
                  {publishError?.id === post.id ? (
                    <p role="alert" className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                      {publishError.message}
                    </p>
                  ) : null}
                  {actionError?.id === post.id ? (
                    <p role="alert" className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                      {actionError.message}
                    </p>
                  ) : null}
                  {post.status === "published" && post.provider_permalink ? (
                    <a href={post.provider_permalink} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs text-accent underline">
                      View on Instagram
                    </a>
                  ) : null}
                  {post.status === "published" ? (
                    <div className="mt-2">
                      {insightsError?.id === post.id ? (
                        <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">
                          {insightsError.message}
                        </p>
                      ) : insightsById[post.id] ? (
                        Object.keys(insightsById[post.id].metrics).length === 0 ? (
                          <p className="text-xs text-text-muted">Insights may not be available yet.</p>
                        ) : (
                          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-muted">
                            {INSIGHT_METRIC_LABELS.filter(({ key }) => insightsById[post.id].metrics[key] !== undefined).map(({ key, label }) => (
                              <span key={key}>
                                <span className="font-semibold text-text">{insightsById[post.id].metrics[key]}</span> {label}
                              </span>
                            ))}
                          </div>
                        )
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {(post.status === "draft" || post.status === "failed") && (
                    <Button variant="secondary" onClick={() => setScheduleDialog({ kind: "schedule", post })}>
                      Schedule
                    </Button>
                  )}
                  {(post.status === "draft" || post.status === "failed" || post.status === "scheduled") && (
                    <Button variant="secondary" onClick={() => handlePublish(post)} disabled={publishingId === post.id}>
                      {publishingId === post.id ? "Publishing…" : post.status === "failed" ? "Retry" : "Publish Now"}
                    </Button>
                  )}
                  {post.status === "scheduled" && (
                    <>
                      <Button variant="secondary" onClick={() => setScheduleDialog({ kind: "reschedule", post })} disabled={publishingId === post.id}>
                        Reschedule
                      </Button>
                      <Button variant="secondary" onClick={() => handleCancelSchedule(post)} disabled={cancelingId === post.id || publishingId === post.id}>
                        {cancelingId === post.id ? "Cancelling…" : "Cancel schedule"}
                      </Button>
                    </>
                  )}
                  {post.status === "publishing" && (
                    <span aria-live="polite" className="text-xs font-medium text-text-muted">
                      Publishing…
                    </span>
                  )}
                  {post.status === "published" && (
                    <Button variant="secondary" onClick={() => handleFetchInsights(post)} disabled={insightsLoadingId === post.id}>
                      {insightsLoadingId === post.id ? "Loading…" : "Refresh insights"}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <SocialScheduleDialog
        open={scheduleDialog !== null}
        onClose={() => setScheduleDialog(null)}
        title={scheduleDialog?.kind === "reschedule" ? "Reschedule post" : "Schedule post"}
        submitLabel={scheduleDialog?.kind === "reschedule" ? "Reschedule" : "Schedule"}
        initialScheduledAt={scheduleDialog?.kind === "reschedule" ? scheduleDialog.post.scheduled_at : null}
        initialScheduledTimezone={scheduleDialog?.kind === "reschedule" ? scheduleDialog.post.scheduled_timezone : null}
        onSubmit={handleScheduleSubmit}
      />
    </div>
  );
}
