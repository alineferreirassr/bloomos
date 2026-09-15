"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { formatDateOnly } from "@/lib/dateFormat";
import { updateCarouselItemAction, archiveCarouselItemAction, unarchiveCarouselItemAction } from "@/modules/carousel/carouselActions";
import { getIdeaItemAction, listIdeaItemsAction } from "@/modules/idea/ideaActions";
import { CarouselSlideEditor } from "@/modules/carousel/components/CarouselSlideEditor";
import type { CarouselItem } from "@/types/carouselItem";
import type { IdeaItem } from "@/types/ideaItem";

interface CarouselDetailDialogProps {
  /** null closes the dialog — mirrors `ScriptDetailDialog`'s own convention of keying off the selected record instead of a separate open flag. */
  item: CarouselItem | null;
  onClose: () => void;
  /** Whether the caller holds social.create — editing/linking/archiving/slide controls are hidden, not merely disabled, for a read-only viewer. The Server Actions themselves are still the real enforcement boundary. */
  canManage: boolean;
  onChanged: (item: CarouselItem) => void;
}

type IdeaPickerState = { status: "idle" } | { status: "loading" } | { status: "error" } | { status: "ready"; items: IdeaItem[] };

/**
 * SOCIAL-10E — combines Detail + Edit + Slide management in one dialog,
 * mirroring `ScriptDetailDialog.tsx`'s own shape exactly: a Carousel's own
 * directly-editable field set (title, source_idea_id) is small enough that
 * a dedicated Edit dialog would just be indirection. Unlike Script, there
 * is no Draft/Version layer at all (SOCIAL-10B decided Carousel needs no
 * versioning) — slides render directly under the Carousel, always, with no
 * "Start Draft" gate. Never copies the linked Idea's own title/description/
 * hook/cta/audience/notes — the Idea picker only ever sets `source_idea_id`,
 * exactly like `ScriptDetailDialog`'s own Idea picker never copies Idea
 * content.
 */
export function CarouselDetailDialog({ item, onClose, canManage, onChanged }: CarouselDetailDialogProps) {
  const [wasItemId, setWasItemId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [sourceIdeaId, setSourceIdeaId] = useState<string | null>(null);
  const [linkedIdeaTitle, setLinkedIdeaTitle] = useState<{ forId: string; title: string | null } | null>(null);
  const [ideaPicker, setIdeaPicker] = useState<IdeaPickerState>({ status: "idle" });
  const [ideaPickerOpen, setIdeaPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentItemId = item?.id ?? null;
  if (currentItemId !== wasItemId) {
    setWasItemId(currentItemId);
    if (item) {
      setTitle(item.title);
      setSourceIdeaId(item.source_idea_id);
      setIdeaPicker({ status: "idle" });
      setIdeaPickerOpen(false);
      setError(null);
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!sourceIdeaId) return;
    let cancelled = false;
    getIdeaItemAction(sourceIdeaId).then((result) => {
      if (cancelled) return;
      setLinkedIdeaTitle({ forId: sourceIdeaId, title: result.success ? result.data.title : null });
    });
    return () => {
      cancelled = true;
    };
  }, [sourceIdeaId]);

  if (!item) return null;

  function openIdeaPicker() {
    setIdeaPickerOpen(true);
    if (ideaPicker.status === "idle" || ideaPicker.status === "error") {
      setIdeaPicker({ status: "loading" });
      listIdeaItemsAction().then((result) => {
        setIdeaPicker(result.success ? { status: "ready", items: result.data } : { status: "error" });
      });
    }
  }

  function handleSelectIdea(ideaId: string) {
    setSourceIdeaId(ideaId);
    setIdeaPickerOpen(false);
  }

  function handleRemoveIdea() {
    setSourceIdeaId(null);
    setIdeaPickerOpen(false);
  }

  async function handleSave() {
    if (!item) return;
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await updateCarouselItemAction(item.id, { title: title.trim(), source_idea_id: sourceIdeaId });
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

  async function handleArchiveToggle() {
    if (!item) return;
    setBusy(true);
    setError(null);
    try {
      const result = item.archived_at ? await unarchiveCarouselItemAction(item.id) : await archiveCarouselItemAction(item.id);
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

  const resolvedLinkedTitle = sourceIdeaId && linkedIdeaTitle?.forId === sourceIdeaId ? linkedIdeaTitle.title : null;
  const isArchived = !!item.archived_at;

  return (
    <Modal open={item !== null} onClose={onClose} title={item.title}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-1.5">{isArchived ? <Badge tone="neutral">Archived</Badge> : null}</div>

        <div>
          <label htmlFor="carousel-detail-title" className="mb-1.5 block text-xs font-medium text-text-muted">
            Title
          </label>
          <Input id="carousel-detail-title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canManage || isArchived || busy} invalid={!!error} />
        </div>

        <div>
          <span className="mb-1.5 block text-xs font-medium text-text-muted">From Idea (optional)</span>
          <div className="flex items-center gap-3">
            <p className="min-w-0 flex-1 truncate text-sm text-text">{sourceIdeaId ? (resolvedLinkedTitle ?? "Loading…") : "Not linked"}</p>
            {canManage && !isArchived ? (
              <Button type="button" variant="secondary" onClick={openIdeaPicker} disabled={busy}>
                {sourceIdeaId ? "Change" : "Link Idea"}
              </Button>
            ) : null}
            {canManage && !isArchived && sourceIdeaId ? (
              <Button type="button" variant="ghost" onClick={handleRemoveIdea} disabled={busy}>
                Remove reference
              </Button>
            ) : null}
          </div>

          {ideaPickerOpen ? (
            <div className="mt-3 rounded-md border border-border p-2.5">
              {ideaPicker.status === "loading" ? <p className="text-xs text-text-muted">Loading your Ideas library…</p> : null}
              {ideaPicker.status === "error" ? <p className="text-xs text-text-muted">Could not load Ideas.</p> : null}
              {ideaPicker.status === "ready" && ideaPicker.items.length === 0 ? <p className="text-xs text-text-muted">No Ideas saved yet.</p> : null}
              {ideaPicker.status === "ready" && ideaPicker.items.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  {ideaPicker.items.map((idea) => (
                    <IdeaOptionRow key={idea.id} item={idea} selected={idea.id === sourceIdeaId} onSelect={() => handleSelectIdea(idea.id)} />
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

        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Close
          </Button>
          {canManage && !isArchived ? (
            <Button type="button" variant="secondary" onClick={handleSave} disabled={busy} aria-busy={busy}>
              {busy ? "Saving…" : "Save changes"}
            </Button>
          ) : null}
          {canManage ? (
            <Button type="button" onClick={handleArchiveToggle} disabled={busy} aria-busy={busy}>
              {busy ? "Saving…" : isArchived ? "Restore" : "Archive"}
            </Button>
          ) : null}
        </div>

        <div className="border-t border-border pt-4">
          <p className="mb-2 text-xs font-medium text-text-muted">Slides</p>
          <CarouselSlideEditor carouselId={item.id} canManage={canManage && !isArchived} />
        </div>

        <p className="text-xs text-text-muted">Created {formatDateOnly(item.created_at)}</p>
      </div>
    </Modal>
  );
}

/** A title-only selectable row — mirrors `ScriptDetailDialog.tsx`'s own `IdeaOptionRow` exactly, simplified since an Idea row has no thumbnail concern of its own. */
function IdeaOptionRow({ item, selected, onSelect }: { item: IdeaItem; selected: boolean; onSelect: () => void }) {
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
