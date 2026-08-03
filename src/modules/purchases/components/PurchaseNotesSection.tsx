"use client";

import { useEffect, useState } from "react";
import { getNotesByPurchaseId, createPurchaseNote, updatePurchaseNote, togglePurchaseNotePin } from "@/lib/data";
import type { Note } from "@/types/note";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { NotesSection } from "@/modules/notes/components/NotesSection";

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; notes: Note[] };

async function loadPurchaseNotes(purchaseId: string): Promise<LoadState> {
  try {
    const notes = await getNotesByPurchaseId(purchaseId);
    return { status: "ready", notes };
  } catch {
    return { status: "error" };
  }
}

/**
 * Fetches independently of PurchaseDetailView and every other section — a
 * Notes failure must never blank the rest of the Purchase page. Mirrors
 * InventoryNotesSection exactly.
 */
export function PurchaseNotesSection({ workspaceId, purchaseId }: { workspaceId: string; purchaseId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    loadPurchaseNotes(purchaseId).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [purchaseId]);

  const refetch = () => {
    loadPurchaseNotes(purchaseId).then(setState);
  };

  const retry = () => {
    setState({ status: "loading" });
    loadPurchaseNotes(purchaseId).then(setState);
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
    return <ErrorState message="Could not load this purchase's notes." onRetry={retry} />;
  }

  return (
    <NotesSection
      workspaceId={workspaceId}
      ownerType="purchase"
      ownerId={purchaseId}
      notes={state.notes}
      onCreateNote={(input) => createPurchaseNote(purchaseId, input)}
      onUpdateNote={(noteId, input) => updatePurchaseNote(noteId, input)}
      onTogglePin={(noteId) => togglePurchaseNotePin(noteId)}
      readOnly={false}
      onNotesChanged={refetch}
    />
  );
}
