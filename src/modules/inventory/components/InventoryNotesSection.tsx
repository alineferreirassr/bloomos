"use client";

import { useEffect, useState } from "react";
import { getNotesByInventoryItemId, createInventoryItemNote, updateInventoryItemNote, toggleInventoryItemNotePin } from "@/lib/data";
import type { Note } from "@/types/note";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { NotesSection } from "@/modules/notes/components/NotesSection";

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; notes: Note[] };

async function loadInventoryItemNotes(inventoryItemId: string): Promise<LoadState> {
  try {
    const notes = await getNotesByInventoryItemId(inventoryItemId);
    return { status: "ready", notes };
  } catch {
    return { status: "error" };
  }
}

/**
 * Fetches independently of InventoryItemDetailView and the Timeline/Movement
 * History/Documents sections — same rationale as VendorNotesSection: a
 * Notes failure must never blank the rest of the item page.
 */
export function InventoryNotesSection({ workspaceId, inventoryItemId }: { workspaceId: string; inventoryItemId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    loadInventoryItemNotes(inventoryItemId).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [inventoryItemId]);

  const refetch = () => {
    loadInventoryItemNotes(inventoryItemId).then(setState);
  };

  const retry = () => {
    setState({ status: "loading" });
    loadInventoryItemNotes(inventoryItemId).then(setState);
  };

  if (state.status === "loading") {
    return (
      <div className="space-y-3" aria-live="polite" aria-busy="true">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (state.status === "error") {
    return <ErrorState message="Could not load this item's notes." onRetry={retry} />;
  }

  return (
    <NotesSection
      workspaceId={workspaceId}
      ownerType="inventory_item"
      ownerId={inventoryItemId}
      notes={state.notes}
      onCreateNote={(input) => createInventoryItemNote(inventoryItemId, input)}
      onUpdateNote={(noteId, input) => updateInventoryItemNote(noteId, input)}
      onTogglePin={(noteId) => toggleInventoryItemNotePin(noteId)}
      readOnly={false}
      onNotesChanged={refetch}
    />
  );
}
