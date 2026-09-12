"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { getMediaAssetDownloadUrl } from "@/lib/data";
import {
  updateInspirationItemAction,
  listInspirationMediaAssetOptionsAction,
  type InspirationItemActionUpdateInput,
} from "@/modules/inspiration/inspirationActions";
import { suggestSourceTypeFromUrl } from "@/lib/inspiration/suggestSourceType";
import { INSPIRATION_SOURCE_TYPE_LABELS, INSPIRATION_CONTENT_FORMAT_LABELS } from "@/modules/inspiration/labels";
import { INSPIRATION_SOURCE_TYPES, INSPIRATION_CONTENT_FORMATS } from "@/types/inspirationItem";
import type { InspirationItem, InspirationSourceType, InspirationContentFormat } from "@/types/inspirationItem";
import { InspirationThumbnail } from "@/modules/inspiration/components/InspirationThumbnail";
import type { MediaAsset } from "@/types/mediaAsset";

interface EditInspirationDialogProps {
  /** null closes the dialog — mirrors InspirationDetailDialog's own `item`-keyed open state. */
  item: InspirationItem | null;
  onClose: () => void;
  onSaved: (item: InspirationItem) => void;
}

type PickerState = { status: "idle" } | { status: "loading" } | { status: "error" } | { status: "ready"; assets: MediaAsset[] };

function toDurationInputValue(seconds: number | null): string {
  return seconds === null ? "" : String(seconds);
}

function fromDurationInputValue(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/** `<input type="datetime-local">` wants "YYYY-MM-DDTHH:mm" in local time, never a raw ISO/UTC string. */
function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromDatetimeLocalValue(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function assetLabel(asset: MediaAsset): string {
  return asset.original_filename;
}

/**
 * SOCIAL-06E — the richer Edit experience, reached only from
 * `InspirationDetailDialog`'s own Edit action (Library → Detail → Edit →
 * Save → Detail refreshed → Library refreshed, per the checkpoint's own
 * UX phase). Calls `updateInspirationItemAction` only — no direct
 * repository access, no second update system. The MediaAsset picker below
 * is a bespoke inline thumbnail grid (mirrors `SocialPostsView.tsx`'s own
 * composer picker exactly) since no reusable picker component exists
 * anywhere in this codebase yet.
 */
export function EditInspirationDialog({ item, onClose, onSaved }: EditInspirationDialogProps) {
  const [wasItemId, setWasItemId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [sourceType, setSourceType] = useState<InspirationSourceType>("manual");
  const [sourceTypeTouched, setSourceTypeTouched] = useState(true);
  const [sourceUrl, setSourceUrl] = useState("");
  const [creatorName, setCreatorName] = useState("");
  const [creatorHandle, setCreatorHandle] = useState("");
  const [platformContentId, setPlatformContentId] = useState("");
  const [contentFormat, setContentFormat] = useState<InspirationContentFormat | "">("");
  const [hook, setHook] = useState("");
  const [cta, setCta] = useState("");
  const [whyItWorks, setWhyItWorks] = useState("");
  const [notes, setNotes] = useState("");
  const [duration, setDuration] = useState("");
  const [publishedAt, setPublishedAt] = useState("");
  const [mediaAssetId, setMediaAssetId] = useState<string | null>(null);

  const [picker, setPicker] = useState<PickerState>({ status: "idle" });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentItemId = item?.id ?? null;
  if (currentItemId !== wasItemId) {
    setWasItemId(currentItemId);
    if (item) {
      setTitle(item.title);
      setSourceType(item.source_type);
      // An existing item's source_type was already a deliberate choice
      // (whether picked manually or accepted from a suggestion at create
      // time) — Phase 7's own "must not unexpectedly overwrite a manually
      // selected source type" means editing the URL here should not
      // silently re-suggest one, UNLESS this item never had a URL at all
      // (a manual reference the founder is now enriching with a link for
      // the first time), which is exactly the same blank-slate case
      // Add Inspiration's own suggestion behavior already covers.
      setSourceTypeTouched(item.source_url !== null);
      setSourceUrl(item.source_url ?? "");
      setCreatorName(item.creator_name ?? "");
      setCreatorHandle(item.creator_handle ?? "");
      setPlatformContentId(item.platform_content_id ?? "");
      setContentFormat(item.content_format ?? "");
      setHook(item.hook ?? "");
      setCta(item.cta ?? "");
      setWhyItWorks(item.why_it_works ?? "");
      setNotes(item.notes ?? "");
      setDuration(toDurationInputValue(item.duration_seconds));
      setPublishedAt(toDatetimeLocalValue(item.published_at));
      setMediaAssetId(item.media_asset_id);
      setPicker({ status: "idle" });
      setPickerOpen(false);
      setError(null);
      setBusy(false);
    }
  }

  if (!item) return null;

  function handleSourceUrlChange(value: string) {
    setSourceUrl(value);
    if (!sourceTypeTouched) {
      const suggested = suggestSourceTypeFromUrl(value);
      if (suggested) setSourceType(suggested);
    }
  }

  function handleSourceTypeChange(value: InspirationSourceType) {
    setSourceTypeTouched(true);
    setSourceType(value);
  }

  function openPicker() {
    setPickerOpen(true);
    if (picker.status === "idle" || picker.status === "error") {
      setPicker({ status: "loading" });
      listInspirationMediaAssetOptionsAction().then((result) => {
        setPicker(result.success ? { status: "ready", assets: result.data } : { status: "error" });
      });
    }
  }

  function handleSelectAsset(assetId: string) {
    setMediaAssetId(assetId);
    setPickerOpen(false);
  }

  function handleRemoveAsset() {
    setMediaAssetId(null);
    setPickerOpen(false);
  }

  async function handleSubmit() {
    if (!item) return;
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const input: InspirationItemActionUpdateInput = {
        title: title.trim(),
        source_type: sourceType,
        source_url: sourceUrl.trim() || null,
        creator_name: creatorName.trim() || null,
        creator_handle: creatorHandle.trim() || null,
        platform_content_id: platformContentId.trim() || null,
        content_format: contentFormat || null,
        hook: hook.trim() || null,
        cta: cta.trim() || null,
        why_it_works: whyItWorks.trim() || null,
        notes: notes.trim() || null,
        duration_seconds: fromDurationInputValue(duration),
        published_at: fromDatetimeLocalValue(publishedAt),
        media_asset_id: mediaAssetId,
      };
      const result = await updateInspirationItemAction(item.id, input);
      if (!result.success) {
        setError(result.error);
        return;
      }
      onSaved(result.data);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={item !== null} onClose={onClose} title={`Edit ${item.title}`}>
      <div className="flex flex-col gap-3">
        <div>
          <label htmlFor="inspiration-edit-title" className="mb-1.5 block text-xs font-medium text-text-muted">
            Title
          </label>
          <Input id="inspiration-edit-title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={busy} invalid={!!error} />
        </div>

        <div>
          <label htmlFor="inspiration-edit-source-type" className="mb-1.5 block text-xs font-medium text-text-muted">
            Source Type
          </label>
          <Select
            id="inspiration-edit-source-type"
            value={sourceType}
            onChange={(e) => handleSourceTypeChange(e.target.value as InspirationSourceType)}
            disabled={busy}
          >
            {INSPIRATION_SOURCE_TYPES.map((type) => (
              <option key={type} value={type}>
                {INSPIRATION_SOURCE_TYPE_LABELS[type]}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label htmlFor="inspiration-edit-source-url" className="mb-1.5 block text-xs font-medium text-text-muted">
            Source URL (optional)
          </label>
          <Input
            id="inspiration-edit-source-url"
            type="url"
            value={sourceUrl}
            onChange={(e) => handleSourceUrlChange(e.target.value)}
            disabled={busy}
            placeholder="https://…"
          />
        </div>

        <div>
          <label htmlFor="inspiration-edit-platform-content-id" className="mb-1.5 block text-xs font-medium text-text-muted">
            Platform Content ID (optional)
          </label>
          <Input id="inspiration-edit-platform-content-id" value={platformContentId} onChange={(e) => setPlatformContentId(e.target.value)} disabled={busy} />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="inspiration-edit-creator-name" className="mb-1.5 block text-xs font-medium text-text-muted">
              Creator Name (optional)
            </label>
            <Input id="inspiration-edit-creator-name" value={creatorName} onChange={(e) => setCreatorName(e.target.value)} disabled={busy} />
          </div>
          <div>
            <label htmlFor="inspiration-edit-creator-handle" className="mb-1.5 block text-xs font-medium text-text-muted">
              Creator Handle (optional)
            </label>
            <Input id="inspiration-edit-creator-handle" value={creatorHandle} onChange={(e) => setCreatorHandle(e.target.value)} disabled={busy} />
          </div>
        </div>

        <div>
          <label htmlFor="inspiration-edit-content-format" className="mb-1.5 block text-xs font-medium text-text-muted">
            Content Format (optional)
          </label>
          <Select
            id="inspiration-edit-content-format"
            value={contentFormat}
            onChange={(e) => setContentFormat(e.target.value as InspirationContentFormat | "")}
            disabled={busy}
          >
            <option value="">Not specified</option>
            {INSPIRATION_CONTENT_FORMATS.map((format) => (
              <option key={format} value={format}>
                {INSPIRATION_CONTENT_FORMAT_LABELS[format]}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label htmlFor="inspiration-edit-hook" className="mb-1.5 block text-xs font-medium text-text-muted">
            Hook (optional)
          </label>
          <Input id="inspiration-edit-hook" value={hook} onChange={(e) => setHook(e.target.value)} disabled={busy} />
        </div>

        <div>
          <label htmlFor="inspiration-edit-cta" className="mb-1.5 block text-xs font-medium text-text-muted">
            CTA (optional)
          </label>
          <Input id="inspiration-edit-cta" value={cta} onChange={(e) => setCta(e.target.value)} disabled={busy} />
        </div>

        <div>
          <label htmlFor="inspiration-edit-why-it-works" className="mb-1.5 block text-xs font-medium text-text-muted">
            Why It Works (optional)
          </label>
          <Textarea id="inspiration-edit-why-it-works" value={whyItWorks} onChange={(e) => setWhyItWorks(e.target.value)} disabled={busy} />
        </div>

        <div>
          <label htmlFor="inspiration-edit-notes" className="mb-1.5 block text-xs font-medium text-text-muted">
            Notes (optional)
          </label>
          <Textarea id="inspiration-edit-notes" value={notes} onChange={(e) => setNotes(e.target.value)} disabled={busy} />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="inspiration-edit-duration" className="mb-1.5 block text-xs font-medium text-text-muted">
              Duration in seconds (optional)
            </label>
            <Input id="inspiration-edit-duration" type="number" min="0" value={duration} onChange={(e) => setDuration(e.target.value)} disabled={busy} />
          </div>
          <div>
            <label htmlFor="inspiration-edit-published-at" className="mb-1.5 block text-xs font-medium text-text-muted">
              Published date (optional)
            </label>
            <Input
              id="inspiration-edit-published-at"
              type="datetime-local"
              value={publishedAt}
              onChange={(e) => setPublishedAt(e.target.value)}
              disabled={busy}
            />
          </div>
        </div>

        <div>
          <span className="mb-1.5 block text-xs font-medium text-text-muted">Attached file (optional)</span>
          <div className="flex items-center gap-3">
            {mediaAssetId ? (
              <InspirationThumbnail mediaAssetId={mediaAssetId} sourceType={sourceType} title={title} className="h-20 w-20 shrink-0" />
            ) : (
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-md bg-surface-tint text-[10px] text-text-muted">No file</div>
            )}
            <div className="flex flex-col gap-2">
              <Button type="button" variant="secondary" onClick={openPicker} disabled={busy}>
                {mediaAssetId ? "Change" : "Attach a file"}
              </Button>
              {mediaAssetId ? (
                <Button type="button" variant="ghost" onClick={handleRemoveAsset} disabled={busy}>
                  Remove attachment
                </Button>
              ) : null}
            </div>
          </div>

          {pickerOpen ? (
            <div className="mt-3 rounded-md border border-border p-2.5">
              {picker.status === "loading" ? <p className="text-xs text-text-muted">Loading your files…</p> : null}
              {picker.status === "error" ? <p className="text-xs text-text-muted">Could not load files.</p> : null}
              {picker.status === "ready" && picker.assets.length === 0 ? <p className="text-xs text-text-muted">No files in your Asset Library yet.</p> : null}
              {picker.status === "ready" && picker.assets.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {picker.assets.map((asset) => (
                    <MediaAssetOptionTile key={asset.id} asset={asset} selected={asset.id === mediaAssetId} onSelect={() => handleSelectAsset(asset.id)} />
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {error ? (
          <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
            {error}
          </p>
        ) : null}

        <div className="mt-1 flex items-center justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={busy} aria-busy={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/** One selectable tile in the inline picker grid — mirrors `SocialPostsView.tsx`'s own composer image-picker exactly (signed-URL-per-tile, `aria-pressed` selected state), generalized to any file type since Inspiration attachment isn't image-only. */
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
