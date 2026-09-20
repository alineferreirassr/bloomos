"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { listMediaAssetsForWorkspace } from "@/lib/data";
import { MediaKitAssetPreview } from "@/modules/mediaKit/components/MediaKitAssetPreview";
import { getMediaKitGalleryItemsData } from "@/modules/mediaKit/getMediaKitGalleryItemsData";
import { addMediaKitGalleryItemAction } from "@/modules/mediaKit/addMediaKitGalleryItemAction";
import { updateMediaKitGalleryItemAction } from "@/modules/mediaKit/updateMediaKitGalleryItemAction";
import { archiveMediaKitGalleryItemAction } from "@/modules/mediaKit/archiveMediaKitGalleryItemAction";
import { reorderMediaKitGalleryItemsAction } from "@/modules/mediaKit/reorderMediaKitGalleryItemsAction";
import type { MediaKitGalleryItem } from "@/types/mediaKit";
import type { MediaAsset } from "@/types/mediaAsset";

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; items: MediaKitGalleryItem[] };
type PickerState = { status: "closed" } | { status: "loading" } | { status: "error" } | { status: "ready"; assets: MediaAsset[] };

interface MediaKitGalleryPickerProps {
  workspaceId: string;
  /** `null` curates the top-level Gallery section; a real id curates that specific portfolio item's own image set. */
  portfolioItemId: string | null;
  /** Re-runs the Manager's own real Overview read path so the Gallery readiness badge reflects real, current curation state. */
  onChanged: () => void;
}

/**
 * MEDIAKIT-04 — curates EXISTING `media_assets` rows only, never a second
 * asset library. Shared between the top-level Gallery tab and each
 * Portfolio item's own per-item image set (`portfolioItemId` selects the
 * scope) — one component, matching the schema's own single shared table.
 *
 * The asset-picker option list is fetched directly client-side via
 * `listMediaAssetsForWorkspace` (never through a Server Action) — that
 * repository function resolves its session through the browser-only
 * `getClientWorkspaceSession()` (`src/lib/data/media/supabaseRepository.ts`),
 * which reads as unauthenticated when called from inside a `"use server"`
 * action's own call chain, exactly the same class of issue documented on
 * `getMediaKitServiceCurationsForWorkspace` in `@/lib/data/mediaKit` for
 * the Services catalog — same fix, applied here too.
 */
export function MediaKitGalleryPicker({ workspaceId, portfolioItemId, onChanged }: MediaKitGalleryPickerProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [picker, setPicker] = useState<PickerState>({ status: "closed" });
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);
  const [itemError, setItemError] = useState<{ itemId: string; message: string } | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [reorderError, setReorderError] = useState<string | null>(null);
  const [captionDrafts, setCaptionDrafts] = useState<Record<string, string>>({});

  const load = () => {
    setState({ status: "loading" });
    getMediaKitGalleryItemsData(portfolioItemId)
      .then((result) => setState(result.success ? { status: "ready", items: result.data } : { status: "error" }))
      .catch(() => setState({ status: "error" }));
  };

  useEffect(() => {
    let cancelled = false;
    getMediaKitGalleryItemsData(portfolioItemId)
      .then((result) => {
        if (cancelled) return;
        setState(result.success ? { status: "ready", items: result.data } : { status: "error" });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [portfolioItemId]);

  function openPicker() {
    setPicker({ status: "loading" });
    setAddError(null);
    listMediaAssetsForWorkspace(workspaceId)
      .then((assets) => setPicker({ status: "ready", assets: assets.filter((asset) => asset.status === "approved") }))
      .catch(() => setPicker({ status: "error" }));
  }

  async function handleAdd(mediaAssetId: string) {
    setAddError(null);
    const result = await addMediaKitGalleryItemAction(portfolioItemId, mediaAssetId);
    if (!result.success) {
      setAddError(result.error);
      return;
    }
    setPicker({ status: "closed" });
    load();
    onChanged();
  }

  async function handleToggleIncluded(item: MediaKitGalleryItem) {
    setItemError(null);
    setPendingItemId(item.id);
    const result = await updateMediaKitGalleryItemAction(item.id, { caption: item.caption, is_cover: item.is_cover, is_included: !item.is_included });
    setPendingItemId(null);
    if (!result.success) {
      setItemError({ itemId: item.id, message: result.error });
      return;
    }
    load();
    onChanged();
  }

  async function handleToggleCover(item: MediaKitGalleryItem) {
    setItemError(null);
    setPendingItemId(item.id);
    const result = await updateMediaKitGalleryItemAction(item.id, { caption: item.caption, is_cover: !item.is_cover, is_included: item.is_included });
    setPendingItemId(null);
    if (!result.success) {
      setItemError({ itemId: item.id, message: result.error });
      return;
    }
    load();
  }

  async function handleSaveCaption(item: MediaKitGalleryItem) {
    const draft = captionDrafts[item.id];
    if (draft === undefined) return;
    setItemError(null);
    setPendingItemId(item.id);
    const trimmed = draft.trim();
    const result = await updateMediaKitGalleryItemAction(item.id, { caption: trimmed || null, is_cover: item.is_cover, is_included: item.is_included });
    setPendingItemId(null);
    if (!result.success) {
      setItemError({ itemId: item.id, message: result.error });
      return;
    }
    setCaptionDrafts((prev) => {
      const next = { ...prev };
      delete next[item.id];
      return next;
    });
    load();
  }

  async function handleRemove(item: MediaKitGalleryItem) {
    setItemError(null);
    setPendingItemId(item.id);
    const result = await archiveMediaKitGalleryItemAction(item.id);
    setPendingItemId(null);
    if (!result.success) {
      setItemError({ itemId: item.id, message: result.error });
      return;
    }
    load();
    onChanged();
  }

  async function moveItem(items: MediaKitGalleryItem[], itemId: string, direction: "up" | "down") {
    setReorderError(null);
    const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
    const index = sorted.findIndex((row) => row.id === itemId);
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (index === -1 || targetIndex < 0 || targetIndex >= sorted.length) return;

    const reordered = [...sorted];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    const result = await reorderMediaKitGalleryItemsAction(portfolioItemId, reordered.map((row) => row.id));
    if (!result.success) {
      setReorderError(result.error);
      return;
    }
    load();
  }

  if (state.status === "loading") {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="aspect-[4/3] w-full" />
        ))}
      </div>
    );
  }

  if (state.status === "error") {
    return <ErrorState message="This Gallery couldn't be loaded." onRetry={load} />;
  }

  const { items } = state;
  const sortedItems = [...items].sort((a, b) => a.sort_order - b.sort_order);
  const addedAssetIds = new Set(items.map((item) => item.media_asset_id));

  return (
    <div className="space-y-4">
      {reorderError ? (
        <p role="alert" className="text-xs text-danger">
          {reorderError}
        </p>
      ) : null}

      {sortedItems.length === 0 ? (
        <EmptyState title="No images yet" description="Add images from your existing Media Assets." />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {sortedItems.map((item, index) => {
            const isPending = pendingItemId === item.id;
            const captionDraft = captionDrafts[item.id] ?? item.caption ?? "";
            return (
              <li key={item.id} className="space-y-1.5 rounded-[0.625rem] border border-border bg-surface p-2">
                <div className="relative">
                  <MediaKitAssetPreview mediaAssetId={item.media_asset_id} title={item.caption ?? "Gallery image"} />
                  {item.is_cover ? (
                    <span className="absolute top-1.5 left-1.5 rounded-full bg-accent-100 px-2 py-0.5 text-[9px] font-medium tracking-wide text-accent uppercase">Cover</span>
                  ) : null}
                </div>
                <Input
                  aria-label="Caption"
                  placeholder="Caption"
                  value={captionDraft}
                  disabled={isPending}
                  onChange={(event) => setCaptionDrafts((prev) => ({ ...prev, [item.id]: event.target.value }))}
                  onBlur={() => handleSaveCaption(item)}
                  className="h-8 text-xs"
                />
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <label className="flex items-center gap-1 text-[11px] text-text-muted">
                    <Checkbox checked={item.is_included} disabled={isPending} onChange={() => handleToggleIncluded(item)} />
                    Included
                  </label>
                  <label className="flex items-center gap-1 text-[11px] text-text-muted">
                    <Checkbox checked={item.is_cover} disabled={isPending} onChange={() => handleToggleCover(item)} />
                    Cover
                  </label>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      aria-label="Move up"
                      disabled={index === 0 || isPending}
                      onClick={() => moveItem(sortedItems, item.id, "up")}
                      className="flex h-5 w-5 items-center justify-center text-text-muted transition-colors duration-150 hover:text-text disabled:pointer-events-none disabled:opacity-30"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      aria-label="Move down"
                      disabled={index === sortedItems.length - 1 || isPending}
                      onClick={() => moveItem(sortedItems, item.id, "down")}
                      className="flex h-5 w-5 items-center justify-center text-text-muted transition-colors duration-150 hover:text-text disabled:pointer-events-none disabled:opacity-30"
                    >
                      ▼
                    </button>
                  </div>
                  <button type="button" onClick={() => handleRemove(item)} disabled={isPending} className="text-[11px] text-danger hover:underline disabled:pointer-events-none disabled:opacity-45">
                    Remove
                  </button>
                </div>
                {itemError?.itemId === item.id ? (
                  <p role="alert" className="text-[11px] text-danger">
                    {itemError.message}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {picker.status === "closed" ? (
        <Button type="button" variant="secondary" onClick={openPicker}>
          Add from Media Library
        </Button>
      ) : (
        <div className="space-y-2 rounded-[0.625rem] border border-border bg-surface-tint p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-text">Choose an image from your Media Assets</p>
            <Button type="button" variant="secondary" size="sm" onClick={() => setPicker({ status: "closed" })}>
              Close
            </Button>
          </div>
          {addError ? (
            <p role="alert" className="text-xs text-danger">
              {addError}
            </p>
          ) : null}
          {picker.status === "loading" ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="aspect-square w-full" />
              ))}
            </div>
          ) : picker.status === "error" ? (
            <p className="text-xs text-danger">Your Media Assets couldn&apos;t be loaded.</p>
          ) : picker.assets.length === 0 ? (
            <p className="text-xs text-text-muted">No approved Media Assets yet. Upload and approve images from your Media Library first.</p>
          ) : (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {picker.assets.map((asset) => {
                const alreadyAdded = addedAssetIds.has(asset.id);
                return (
                  <li key={asset.id}>
                    <button
                      type="button"
                      disabled={alreadyAdded}
                      onClick={() => handleAdd(asset.id)}
                      className="w-full space-y-1 rounded-[0.625rem] border border-border p-1 text-left transition-colors duration-150 hover:border-accent disabled:pointer-events-none disabled:opacity-45"
                    >
                      <MediaKitAssetPreview mediaAssetId={asset.id} title={asset.original_filename} className="aspect-square" />
                      <p className="truncate text-[10px] text-text-muted">{alreadyAdded ? "Already added" : asset.original_filename}</p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
