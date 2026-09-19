"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { getMediaAssetDownloadUrl } from "@/lib/data";
import { updateIdeaItemAction, listIdeaMediaAssetOptionsAction, type IdeaItemActionUpdateInput } from "@/modules/idea/ideaActions";
import { getInspirationItemAction, listInspirationItemsAction } from "@/modules/inspiration/inspirationActions";
import { IDEA_PRIORITY_LABELS } from "@/modules/idea/labels";
import { INSPIRATION_CONTENT_FORMAT_LABELS } from "@/modules/inspiration/labels";
import { INSPIRATION_CONTENT_FORMATS } from "@/types/inspirationItem";
import { IDEA_PRIORITIES } from "@/types/ideaItem";
import { IdeaMediaAssetPreview } from "@/modules/idea/components/IdeaMediaAssetPreview";
import type { IdeaItem, IdeaPriority } from "@/types/ideaItem";
import type { InspirationContentFormat, InspirationItem } from "@/types/inspirationItem";
import type { MediaAsset } from "@/types/mediaAsset";

interface EditIdeaDialogProps {
  /** null closes the dialog — mirrors `EditInspirationDialog`'s own `item`-keyed open state. */
  item: IdeaItem | null;
  onClose: () => void;
  onSaved: (item: IdeaItem) => void;
}

type MediaPickerState = { status: "idle" } | { status: "loading" } | { status: "error" } | { status: "ready"; assets: MediaAsset[] };
type InspirationPickerState = { status: "idle" } | { status: "loading" } | { status: "error" } | { status: "ready"; items: InspirationItem[] };

function assetLabel(asset: MediaAsset): string {
  return asset.original_filename;
}

/**
 * SOCIAL-07E — the richer Edit experience, reached only from
 * `IdeaDetailDialog`'s own Edit action (Library → Detail → Edit → Save →
 * Detail refreshed → Library refreshed), mirroring
 * `EditInspirationDialog.tsx`'s SOCIAL-06E shape exactly. Calls
 * `updateIdeaItemAction` only — no direct repository access. Both pickers
 * below are bespoke inline components (no reusable picker exists anywhere
 * in this codebase — confirmed fresh this checkpoint) and never copy
 * content: the Inspiration picker only ever sets `source_inspiration_id`,
 * never hook/cta/notes/description from the picked Inspiration; the
 * MediaAsset picker only ever sets `media_asset_id`, never mutates the
 * MediaAsset itself.
 */
export function EditIdeaDialog({ item, onClose, onSaved }: EditIdeaDialogProps) {
  const [wasItemId, setWasItemId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [contentFormat, setContentFormat] = useState<InspirationContentFormat | "">("");
  const [priority, setPriority] = useState<IdeaPriority | "">("");
  const [hook, setHook] = useState("");
  const [cta, setCta] = useState("");
  const [audience, setAudience] = useState("");
  const [notes, setNotes] = useState("");
  const [mediaAssetId, setMediaAssetId] = useState<string | null>(null);
  const [sourceInspirationId, setSourceInspirationId] = useState<string | null>(null);

  const [mediaPicker, setMediaPicker] = useState<MediaPickerState>({ status: "idle" });
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [inspirationPicker, setInspirationPicker] = useState<InspirationPickerState>({ status: "idle" });
  const [inspirationPickerOpen, setInspirationPickerOpen] = useState(false);
  const [linkedInspirationTitle, setLinkedInspirationTitle] = useState<{ forId: string; title: string | null } | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentItemId = item?.id ?? null;
  if (currentItemId !== wasItemId) {
    setWasItemId(currentItemId);
    if (item) {
      setTitle(item.title);
      setDescription(item.description);
      setContentFormat(item.content_format ?? "");
      setPriority(item.priority ?? "");
      setHook(item.hook ?? "");
      setCta(item.cta ?? "");
      setAudience(item.audience ?? "");
      setNotes(item.notes ?? "");
      setMediaAssetId(item.media_asset_id);
      setSourceInspirationId(item.source_inspiration_id);
      setMediaPicker({ status: "idle" });
      setMediaPickerOpen(false);
      setInspirationPicker({ status: "idle" });
      setInspirationPickerOpen(false);
      setError(null);
      setBusy(false);
    }
  }

  /**
   * Resolves only the linked Inspiration's own title, for display — never
   * its hook/cta/notes/content. Independent of the picker list (which only
   * loads when opened) so the "Linked to" summary works without ever
   * opening the picker.
   */
  useEffect(() => {
    if (!sourceInspirationId) return;
    let cancelled = false;
    getInspirationItemAction(sourceInspirationId).then((result) => {
      if (cancelled) return;
      setLinkedInspirationTitle({ forId: sourceInspirationId, title: result.success ? result.data.title : null });
    });
    return () => {
      cancelled = true;
    };
  }, [sourceInspirationId]);

  if (!item) return null;

  function openMediaPicker() {
    setMediaPickerOpen(true);
    if (mediaPicker.status === "idle" || mediaPicker.status === "error") {
      setMediaPicker({ status: "loading" });
      listIdeaMediaAssetOptionsAction().then((result) => {
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

  function openInspirationPicker() {
    setInspirationPickerOpen(true);
    if (inspirationPicker.status === "idle" || inspirationPicker.status === "error") {
      setInspirationPicker({ status: "loading" });
      listInspirationItemsAction().then((result) => {
        setInspirationPicker(result.success ? { status: "ready", items: result.data } : { status: "error" });
      });
    }
  }

  function handleSelectInspiration(inspirationId: string) {
    setSourceInspirationId(inspirationId);
    setInspirationPickerOpen(false);
  }

  function handleRemoveInspiration() {
    setSourceInspirationId(null);
    setInspirationPickerOpen(false);
  }

  async function handleSubmit() {
    if (!item) return;
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!description.trim()) {
      setError("Description is required.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const input: IdeaItemActionUpdateInput = {
        title: title.trim(),
        description: description.trim(),
        source_inspiration_id: sourceInspirationId,
        content_format: contentFormat || null,
        hook: hook.trim() || null,
        cta: cta.trim() || null,
        audience: audience.trim() || null,
        notes: notes.trim() || null,
        media_asset_id: mediaAssetId,
        priority: priority || null,
      };
      const result = await updateIdeaItemAction(item.id, input);
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
          <label htmlFor="idea-edit-title" className="mb-1.5 block text-xs font-medium text-text-muted">
            Title
          </label>
          <Input id="idea-edit-title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={busy} invalid={!!error} />
        </div>

        <div>
          <label htmlFor="idea-edit-description" className="mb-1.5 block text-xs font-medium text-text-muted">
            Description
          </label>
          <Textarea id="idea-edit-description" value={description} onChange={(e) => setDescription(e.target.value)} disabled={busy} invalid={!!error} />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="idea-edit-content-format" className="mb-1.5 block text-xs font-medium text-text-muted">
              Content Format (optional)
            </label>
            <Select
              id="idea-edit-content-format"
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
            <label htmlFor="idea-edit-priority" className="mb-1.5 block text-xs font-medium text-text-muted">
              Priority (optional)
            </label>
            <Select id="idea-edit-priority" value={priority} onChange={(e) => setPriority(e.target.value as IdeaPriority | "")} disabled={busy}>
              <option value="">Not specified</option>
              {IDEA_PRIORITIES.map((value) => (
                <option key={value} value={value}>
                  {IDEA_PRIORITY_LABELS[value]}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div>
          <label htmlFor="idea-edit-hook" className="mb-1.5 block text-xs font-medium text-text-muted">
            Hook (optional)
          </label>
          <Input id="idea-edit-hook" value={hook} onChange={(e) => setHook(e.target.value)} disabled={busy} />
        </div>

        <div>
          <label htmlFor="idea-edit-cta" className="mb-1.5 block text-xs font-medium text-text-muted">
            CTA (optional)
          </label>
          <Input id="idea-edit-cta" value={cta} onChange={(e) => setCta(e.target.value)} disabled={busy} />
        </div>

        <div>
          <label htmlFor="idea-edit-audience" className="mb-1.5 block text-xs font-medium text-text-muted">
            Audience (optional)
          </label>
          <Input id="idea-edit-audience" value={audience} onChange={(e) => setAudience(e.target.value)} disabled={busy} />
        </div>

        <div>
          <label htmlFor="idea-edit-notes" className="mb-1.5 block text-xs font-medium text-text-muted">
            Notes (optional)
          </label>
          <Textarea id="idea-edit-notes" value={notes} onChange={(e) => setNotes(e.target.value)} disabled={busy} />
        </div>

        <div>
          <span className="mb-1.5 block text-xs font-medium text-text-muted">From Inspiration (optional)</span>
          <div className="flex items-center gap-3">
            <p className="min-w-0 flex-1 truncate text-sm text-text">
              {sourceInspirationId
                ? (linkedInspirationTitle?.forId === sourceInspirationId ? linkedInspirationTitle.title : null) ?? "Loading…"
                : "Not linked"}
            </p>
            <Button type="button" variant="secondary" onClick={openInspirationPicker} disabled={busy}>
              {sourceInspirationId ? "Change" : "Link Inspiration"}
            </Button>
            {sourceInspirationId ? (
              <Button type="button" variant="ghost" onClick={handleRemoveInspiration} disabled={busy}>
                Remove reference
              </Button>
            ) : null}
          </div>

          {inspirationPickerOpen ? (
            <div className="mt-3 rounded-md border border-border p-2.5">
              {inspirationPicker.status === "loading" ? <p className="text-xs text-text-muted">Loading your Inspiration library…</p> : null}
              {inspirationPicker.status === "error" ? <p className="text-xs text-text-muted">Could not load Inspiration items.</p> : null}
              {inspirationPicker.status === "ready" && inspirationPicker.items.length === 0 ? (
                <p className="text-xs text-text-muted">No Inspiration saved yet.</p>
              ) : null}
              {inspirationPicker.status === "ready" && inspirationPicker.items.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  {inspirationPicker.items.map((inspiration) => (
                    <InspirationOptionRow
                      key={inspiration.id}
                      item={inspiration}
                      selected={inspiration.id === sourceInspirationId}
                      onSelect={() => handleSelectInspiration(inspiration.id)}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div>
          <span className="mb-1.5 block text-xs font-medium text-text-muted">Attached file (optional)</span>
          <div className="flex items-center gap-3">
            {mediaAssetId ? (
              <IdeaMediaAssetPreview mediaAssetId={mediaAssetId} title={title} className="h-20 w-20 shrink-0" />
            ) : (
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-md bg-surface-tint text-[10px] text-text-muted">No file</div>
            )}
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

        {error ? (
          <p role="alert" className="text-sm text-danger">
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

/** A title-only selectable row — mirrors `MediaAssetOptionTile`'s own `aria-pressed` selected-state shape, simplified since an Inspiration row has no thumbnail concern of its own. */
function InspirationOptionRow({ item, selected, onSelect }: { item: InspirationItem; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`block w-full truncate rounded-md border px-3 py-2 text-left text-sm ${selected ? "border-accent bg-accent/8 text-text" : "border-border text-text"}`}
    >
      {item.title}
    </button>
  );
}

/** One selectable tile in the inline picker grid — mirrors `EditInspirationDialog.tsx`'s own `MediaAssetOptionTile` exactly (signed-URL-per-tile, `aria-pressed` selected state), copied rather than imported since it isn't exported and every domain that needs it keeps its own copy. */
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
