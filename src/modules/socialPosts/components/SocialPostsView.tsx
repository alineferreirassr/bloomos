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
} from "@/modules/socialPosts/socialPostActions";
import { getSelectedMetaPublishingIdentityAction, type MetaSelectedIdentity } from "@/modules/integrations/meta/metaAccountActions";
import { listMediaAssetsForWorkspace, getMediaAssetDownloadUrl } from "@/lib/data";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";
import { SOCIAL_POST_STATUS_LABELS, type SocialPostStatus } from "@/core/enums/socialPostStatus";
import type { SocialPost } from "@/types/socialPost";
import type { MediaAsset } from "@/types/mediaAsset";

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready" };

const STATUS_TONE: Record<SocialPostStatus, BadgeTone> = {
  draft: "neutral",
  publishing: "warning",
  published: "success",
  failed: "danger",
};

const SUPPORTED_IMAGE_MIME_TYPE = "image/jpeg";

interface PanelData {
  posts: SocialPost[];
  identity: MetaSelectedIdentity | null;
  images: MediaAsset[];
}

/** Pure, module-level fetcher — no closure over component state setters — mirrors `MetaSettingsPanel.tsx`'s own established split so the mount effect never trips `react-hooks/set-state-in-effect`. */
async function fetchPanelData(): Promise<PanelData | null> {
  const [postsResult, identityResult, assets] = await Promise.all([
    listSocialPostsAction(),
    getSelectedMetaPublishingIdentityAction(),
    listMediaAssetsForWorkspace(CURRENT_WORKSPACE_ID),
  ]);
  if (!postsResult.success) return null;

  return {
    posts: postsResult.data,
    identity: identityResult.success ? identityResult.data : null,
    images: assets.filter((asset) => asset.mime_type === SUPPORTED_IMAGE_MIME_TYPE && asset.status === "approved" && !asset.archived_at),
  };
}

function assetLabel(asset: MediaAsset): string {
  return asset.original_filename;
}

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

          <div className="mt-4 flex items-center gap-3">
            <Button variant="secondary" onClick={() => handleCreate(false)} disabled={busy || !selectedAssetId}>
              {busy ? "Saving…" : "Save Draft"}
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
                  {post.status === "failed" && post.provider_error ? (
                    <p role="alert" className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                      {post.provider_error}
                    </p>
                  ) : null}
                  {publishError?.id === post.id ? (
                    <p role="alert" className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                      {publishError.message}
                    </p>
                  ) : null}
                  {post.status === "published" && post.provider_permalink ? (
                    <a href={post.provider_permalink} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs text-accent underline">
                      View on Instagram
                    </a>
                  ) : null}
                </div>
                {(post.status === "draft" || post.status === "failed") && (
                  <Button variant="secondary" onClick={() => handlePublish(post)} disabled={publishingId === post.id}>
                    {publishingId === post.id ? "Publishing…" : post.status === "failed" ? "Retry" : "Publish Now"}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
