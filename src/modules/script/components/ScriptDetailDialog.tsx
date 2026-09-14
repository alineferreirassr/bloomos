"use client";

import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { formatDateOnly } from "@/lib/dateFormat";
import {
  updateScriptItemAction,
  archiveScriptItemAction,
  unarchiveScriptItemAction,
  createScriptVersionAction,
  listScriptVersionsAction,
} from "@/modules/script/scriptActions";
import { getIdeaItemAction, listIdeaItemsAction } from "@/modules/idea/ideaActions";
import { SCRIPT_VERSION_STATUS_LABELS } from "@/modules/script/labels";
import { ScriptBlockEditor } from "@/modules/script/components/ScriptBlockEditor";
import type { ScriptItem } from "@/types/scriptItem";
import type { ScriptVersion } from "@/types/scriptVersion";
import type { IdeaItem } from "@/types/ideaItem";

interface ScriptDetailDialogProps {
  /** null closes the dialog — mirrors `IdeaDetailDialog`'s own convention of keying off the selected record instead of a separate open flag. */
  item: ScriptItem | null;
  onClose: () => void;
  /** Whether the caller holds social.create — editing/linking/archiving/version and block controls are hidden, not merely disabled, for a read-only viewer. The Server Actions themselves are still the real enforcement boundary. */
  canManage: boolean;
  onChanged: (item: ScriptItem) => void;
}

type IdeaPickerState = { status: "idle" } | { status: "loading" } | { status: "error" } | { status: "ready"; items: IdeaItem[] };
type VersionsState = { status: "loading" } | { status: "error" } | { status: "ready"; versions: ScriptVersion[] };

/**
 * SOCIAL-08D — combines Detail + Edit + Version/Block management in one
 * dialog rather than Idea's separate Library→Detail→Edit stack: a Script's
 * own directly-editable field set (title, source_idea_id) is small enough
 * that a dedicated Edit dialog would just be indirection, and Version/Block
 * management has no analog in Idea/Inspiration to mirror a split from.
 * Never copies the linked Idea's own title/description/hook/cta/audience/
 * notes — the Idea picker only ever sets `source_idea_id`, exactly like
 * `EditIdeaDialog`'s own Inspiration picker never copies Inspiration
 * content.
 */
export function ScriptDetailDialog({ item, onClose, canManage, onChanged }: ScriptDetailDialogProps) {
  const [wasItemId, setWasItemId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [sourceIdeaId, setSourceIdeaId] = useState<string | null>(null);
  const [linkedIdeaTitle, setLinkedIdeaTitle] = useState<{ forId: string; title: string | null } | null>(null);
  const [ideaPicker, setIdeaPicker] = useState<IdeaPickerState>({ status: "idle" });
  const [ideaPickerOpen, setIdeaPickerOpen] = useState(false);
  const [versionsState, setVersionsState] = useState<VersionsState>({ status: "loading" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** SOCIAL-08E hardening — guards against an older, slower `loadVersions` call resolving after a newer one (e.g. switching Scripts quickly), mirroring `ScriptLibraryView.tsx`'s own `latestRequestIdRef` pattern. Without this, a stale response could overwrite the currently-open Script's version/draft state. */
  const latestVersionsRequestIdRef = useRef(0);

  const currentItemId = item?.id ?? null;
  if (currentItemId !== wasItemId) {
    setWasItemId(currentItemId);
    if (item) {
      setTitle(item.title);
      setSourceIdeaId(item.source_idea_id);
      setIdeaPicker({ status: "idle" });
      setIdeaPickerOpen(false);
      setVersionsState({ status: "loading" });
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

  function loadVersions(scriptId: string) {
    const requestId = ++latestVersionsRequestIdRef.current;
    listScriptVersionsAction(scriptId).then((result) => {
      if (requestId !== latestVersionsRequestIdRef.current) return;
      setVersionsState(result.success ? { status: "ready", versions: result.data } : { status: "error" });
    });
  }

  useEffect(() => {
    if (currentItemId) loadVersions(currentItemId);
  }, [currentItemId]);

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
      const result = await updateScriptItemAction(item.id, { title: title.trim(), source_idea_id: sourceIdeaId });
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
      const result = item.archived_at ? await unarchiveScriptItemAction(item.id) : await archiveScriptItemAction(item.id);
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

  async function handleStartDraft() {
    if (!item) return;
    setBusy(true);
    setError(null);
    try {
      const result = await createScriptVersionAction(item.id);
      if (!result.success) {
        setError(result.error);
        return;
      }
      loadVersions(item.id);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const resolvedLinkedTitle = sourceIdeaId && linkedIdeaTitle?.forId === sourceIdeaId ? linkedIdeaTitle.title : null;
  const isArchived = !!item.archived_at;
  const draftVersion = versionsState.status === "ready" ? versionsState.versions.find((v) => v.status === "draft") ?? null : null;

  return (
    <Modal open={item !== null} onClose={onClose} title={item.title}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-1.5">{isArchived ? <Badge tone="neutral">Archived</Badge> : null}</div>

        <div>
          <label htmlFor="script-detail-title" className="mb-1.5 block text-xs font-medium text-text-muted">
            Title
          </label>
          <Input id="script-detail-title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canManage || isArchived || busy} invalid={!!error} />
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
          <p className="mb-2 text-xs font-medium text-text-muted">Draft</p>
          {versionsState.status === "loading" ? <p className="text-xs text-text-muted">Loading versions…</p> : null}
          {versionsState.status === "error" ? <p className="text-xs text-text-muted">Could not load versions.</p> : null}
          {versionsState.status === "ready" && !draftVersion ? (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-text-muted">This Script has no draft yet.</p>
              {canManage && !isArchived ? (
                <Button type="button" variant="secondary" onClick={handleStartDraft} disabled={busy}>
                  Start Draft
                </Button>
              ) : null}
            </div>
          ) : null}
          {versionsState.status === "ready" && draftVersion ? <ScriptBlockEditor scriptVersionId={draftVersion.id} canManage={canManage && !isArchived} /> : null}
        </div>

        {versionsState.status === "ready" && versionsState.versions.length > 0 ? (
          <div className="border-t border-border pt-4">
            <p className="mb-2 text-xs font-medium text-text-muted">Versions</p>
            <div className="flex flex-col gap-1.5">
              {versionsState.versions.map((version) => (
                <div key={version.id} className="flex items-center justify-between gap-2 text-sm">
                  <Badge tone={version.status === "published" ? "accent" : "neutral"}>{SCRIPT_VERSION_STATUS_LABELS[version.status]}</Badge>
                  <span className="text-xs text-text-muted">
                    {version.status === "published" && version.published_at ? `Published ${formatDateOnly(version.published_at)}` : `Created ${formatDateOnly(version.created_at)}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

/** A title-only selectable row — mirrors `EditIdeaDialog.tsx`'s own `InspirationOptionRow` exactly, simplified since an Idea row has no thumbnail concern of its own. */
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
