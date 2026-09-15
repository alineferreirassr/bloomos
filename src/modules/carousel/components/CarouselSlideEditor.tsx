"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { ErrorState } from "@/components/ui/ErrorState";
import { getMediaAssetDownloadUrl } from "@/lib/data";
import {
  listCarouselSlidesAction,
  createCarouselSlideAction,
  updateCarouselSlideAction,
  removeCarouselSlideAction,
  listCarouselMediaAssetOptionsAction,
} from "@/modules/carousel/carouselActions";
import { CarouselSlideMediaPreview } from "@/modules/carousel/components/CarouselSlideMediaPreview";
import type { CarouselSlide } from "@/types/carouselSlide";
import type { MediaAsset } from "@/types/mediaAsset";

type SlidesState = { status: "loading" } | { status: "error" } | { status: "ready"; slides: CarouselSlide[] };
type MediaPickerState = { status: "idle" } | { status: "loading" } | { status: "error" } | { status: "ready"; assets: MediaAsset[] };

function assetLabel(asset: MediaAsset): string {
  return asset.original_filename;
}

interface CarouselSlideEditorProps {
  carouselId: string;
  /** Whether the caller holds social.create — Add/Save/Remove/media picking are hidden, not merely disabled, for a read-only viewer. The Server Actions themselves are still the real enforcement boundary. */
  canManage: boolean;
}

/**
 * SOCIAL-10E — the ordered Carousel slide editor, mirroring
 * `ScriptBlockEditor.tsx`'s own backend-authoritative shape exactly: it
 * reloads from `listCarouselSlidesAction` rather than trusting
 * locally-mutated state to stay in sync with the server. Plain text
 * only — no rich text editor, no `dangerouslySetInnerHTML`. Ordering is a
 * plain "Position" number input rather than drag-and-drop, matching
 * `ScriptBlockEditor`'s own precedent exactly (no drag-and-drop library or
 * established interaction exists anywhere in this codebase). Each slide
 * may carry at most one optional MediaAsset, picked via the same bespoke
 * inline picker pattern `EditIdeaDialog.tsx` already established — never a
 * new MediaAsset system, never more than one asset per slide.
 *
 * `carouselId` changes while `CarouselDetailDialog` stays mounted (the
 * user can switch between Carousels without it closing), so `load()`
 * guards against a slower, stale response for a *previous* carousel
 * overwriting the currently-selected one's state — the same
 * `latestRequestIdRef` pattern already established in
 * `ScriptDetailDialog.tsx`'s own `loadVersions` (SOCIAL-08E) and
 * `ContentIntelligencePanel.tsx`.
 */
export function CarouselSlideEditor({ carouselId, canManage }: CarouselSlideEditorProps) {
  const [state, setState] = useState<SlidesState>({ status: "loading" });
  const [addingSlide, setAddingSlide] = useState(false);
  const latestRequestIdRef = useRef(0);

  function load() {
    const requestId = ++latestRequestIdRef.current;
    listCarouselSlidesAction(carouselId).then((result) => {
      if (requestId !== latestRequestIdRef.current) return;
      setState(result.success ? { status: "ready", slides: result.data } : { status: "error" });
    });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when the carousel itself changes, matching every other list view's own [dependency] shape in this codebase
  }, [carouselId]);

  function handleSlideChanged(updated: CarouselSlide) {
    setState((prev) =>
      prev.status === "ready" ? { status: "ready", slides: prev.slides.map((s) => (s.id === updated.id ? updated : s)).sort((a, b) => a.sort_order - b.sort_order) } : prev,
    );
  }

  function handleSlideRemoved(id: string) {
    setState((prev) => (prev.status === "ready" ? { status: "ready", slides: prev.slides.filter((s) => s.id !== id) } : prev));
  }

  async function handleAddSlide() {
    setAddingSlide(true);
    try {
      const nextOrder = state.status === "ready" && state.slides.length > 0 ? Math.max(...state.slides.map((s) => s.sort_order)) + 1 : 0;
      const result = await createCarouselSlideAction(carouselId, { content: "", sort_order: nextOrder, media_asset_id: null });
      if (result.success) load();
    } finally {
      setAddingSlide(false);
    }
  }

  if (state.status === "loading") {
    return <p className="text-xs text-text-muted">Loading slides…</p>;
  }

  if (state.status === "error") {
    return <ErrorState message="Could not load Carousel slides." onRetry={load} />;
  }

  return (
    <div className="flex flex-col gap-3">
      {state.slides.length === 0 ? <p className="text-xs text-text-muted">No slides yet.</p> : null}
      {state.slides.map((slide) => (
        <CarouselSlideRow key={slide.id} carouselId={carouselId} slide={slide} onChanged={handleSlideChanged} onRemoved={handleSlideRemoved} canManage={canManage} />
      ))}
      {canManage ? (
        <Button type="button" variant="secondary" onClick={handleAddSlide} disabled={addingSlide} aria-busy={addingSlide}>
          {addingSlide ? "Adding…" : "Add Slide"}
        </Button>
      ) : null}
    </div>
  );
}

interface CarouselSlideRowProps {
  carouselId: string;
  slide: CarouselSlide;
  onChanged: (slide: CarouselSlide) => void;
  onRemoved: (id: string) => void;
  canManage: boolean;
}

function CarouselSlideRow({ carouselId, slide, onChanged, onRemoved, canManage }: CarouselSlideRowProps) {
  const [content, setContent] = useState(slide.content);
  const [sortOrder, setSortOrder] = useState(slide.sort_order);
  const [mediaAssetId, setMediaAssetId] = useState(slide.media_asset_id);
  const [mediaPicker, setMediaPicker] = useState<MediaPickerState>({ status: "idle" });
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openMediaPicker() {
    setMediaPickerOpen(true);
    if (mediaPicker.status === "idle" || mediaPicker.status === "error") {
      setMediaPicker({ status: "loading" });
      listCarouselMediaAssetOptionsAction().then((result) => {
        setMediaPicker(result.success ? { status: "ready", assets: result.data } : { status: "error" });
      });
    }
  }

  function handleSelectAsset(assetId: string) {
    setMediaAssetId(assetId);
    setMediaPickerOpen(false);
  }

  function handleRemoveAsset() {
    setMediaAssetId(null);
    setMediaPickerOpen(false);
  }

  async function handleSave() {
    setBusy(true);
    setError(null);
    try {
      const result = await updateCarouselSlideAction(carouselId, slide.id, { content, sort_order: sortOrder, media_asset_id: mediaAssetId });
      if (!result.success) {
        setError(result.error);
        return;
      }
      onChanged(result.data);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    setBusy(true);
    setError(null);
    try {
      const result = await removeCarouselSlideAction(carouselId, slide.id);
      if (!result.success) {
        setError(result.error);
        return;
      }
      onRemoved(slide.id);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-md border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <label htmlFor={`carousel-slide-position-${slide.id}`} className="text-xs font-medium text-text-muted">
            Position
          </label>
          <Input
            id={`carousel-slide-position-${slide.id}`}
            type="number"
            min="0"
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value))}
            disabled={!canManage || busy}
            className="w-20"
          />
        </div>
        {canManage ? (
          <Button type="button" variant="ghost" onClick={handleRemove} disabled={busy}>
            Remove
          </Button>
        ) : null}
      </div>

      <div>
        <label htmlFor={`carousel-slide-content-${slide.id}`} className="mb-1 block text-xs font-medium text-text-muted">
          Content
        </label>
        <Textarea
          id={`carousel-slide-content-${slide.id}`}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          disabled={!canManage || busy}
        />
      </div>

      <div>
        <span className="mb-1.5 block text-xs font-medium text-text-muted">Media (optional)</span>
        <div className="flex items-center gap-3">
          <CarouselSlideMediaPreview mediaAssetId={mediaAssetId} title={`Slide ${slide.sort_order + 1}`} className="h-16 w-16 shrink-0" />
          {canManage ? (
            <div className="flex flex-col gap-2">
              <Button type="button" variant="secondary" onClick={openMediaPicker} disabled={busy}>
                {mediaAssetId ? "Change" : "Attach a file"}
              </Button>
              {mediaAssetId ? (
                <Button type="button" variant="ghost" onClick={handleRemoveAsset} disabled={busy}>
                  Remove attachment
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>

        {mediaPickerOpen ? (
          <div className="mt-3 rounded-md border border-border p-2.5">
            {mediaPicker.status === "loading" ? <p className="text-xs text-text-muted">Loading your files…</p> : null}
            {mediaPicker.status === "error" ? <p className="text-xs text-text-muted">Could not load files.</p> : null}
            {mediaPicker.status === "ready" && mediaPicker.assets.length === 0 ? <p className="text-xs text-text-muted">No files in your Asset Library yet.</p> : null}
            {mediaPicker.status === "ready" && mediaPicker.assets.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {mediaPicker.assets.map((asset) => (
                  <MediaAssetOptionTile key={asset.id} asset={asset} selected={asset.id === mediaAssetId} onSelect={() => handleSelectAsset(asset.id)} />
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {canManage ? (
        <div className="flex justify-end">
          <Button type="button" variant="secondary" onClick={handleSave} disabled={busy} aria-busy={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** One selectable tile in the inline picker grid — mirrors `EditIdeaDialog.tsx`'s own `MediaAssetOptionTile` exactly (signed-URL-per-tile, `aria-pressed` selected state), copied rather than imported since it isn't exported and every domain that needs it keeps its own copy. */
function MediaAssetOptionTile({ asset, selected, onSelect }: { asset: MediaAsset; selected: boolean; onSelect: () => void }) {
  const [resolved, setResolved] = useState<{ forAssetId: string; url: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMediaAssetDownloadUrl(asset.id, 300).then((result) => {
      if (cancelled) return;
      setResolved({ forAssetId: asset.id, url: result.success && result.data.url.startsWith("http") ? result.data.url : null });
    });
    return () => {
      cancelled = true;
    };
  }, [asset.id]);

  const current = resolved?.forAssetId === asset.id ? resolved.url : null;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      title={assetLabel(asset)}
      className={`flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border-2 ${selected ? "border-accent" : "border-border"}`}
    >
      {current ? (
        // eslint-disable-next-line @next/next/no-img-element -- a real signed Supabase Storage URL, not a static asset Next can optimize
        <img src={current} alt={assetLabel(asset)} className="h-full w-full object-cover" />
      ) : (
        <span className="text-[9px] text-text-muted">{asset.extension}</span>
      )}
    </button>
  );
}
