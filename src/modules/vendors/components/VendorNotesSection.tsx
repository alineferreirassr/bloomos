"use client";

import { useEffect, useState } from "react";
import { getNotesByVendorId, createVendorNote, updateVendorNote, toggleVendorNotePin } from "@/lib/data";
import type { Note } from "@/types/note";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { NotesSection } from "@/modules/notes/components/NotesSection";

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; notes: Note[] };

async function loadVendorNotes(vendorId: string): Promise<LoadState> {
  try {
    const notes = await getNotesByVendorId(vendorId);
    return { status: "ready", notes };
  } catch {
    return { status: "error" };
  }
}

/**
 * Fetches independently of VendorDetailView and VendorTimelineSection (own
 * effect, own loading/error state) — same rationale as VendorTimelineSection:
 * a Notes failure must never blank the rest of the Vendor page or the
 * Timeline card, and vice versa.
 *
 * Deliberately not coupled to VendorTimelineSection: creating a note does
 * write a `note_added` Timeline activity, but wiring a refresh between the
 * two sections would require either lifting both fetches into one combined
 * parent loader (the entangled pattern VendorDetailView's Timeline section
 * already deliberately avoids) or a feature-specific event bus (explicitly
 * out of scope). The Timeline card simply reflects new note activity on the
 * next full Vendor page load.
 */
export function VendorNotesSection({ workspaceId, vendorId }: { workspaceId: string; vendorId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    loadVendorNotes(vendorId).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [vendorId]);

  const refetch = () => {
    loadVendorNotes(vendorId).then(setState);
  };

  const retry = () => {
    setState({ status: "loading" });
    loadVendorNotes(vendorId).then(setState);
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
    return <ErrorState message="Could not load this vendor's notes." onRetry={retry} />;
  }

  return (
    <NotesSection
      workspaceId={workspaceId}
      ownerType="vendor"
      ownerId={vendorId}
      notes={state.notes}
      onCreateNote={(input) => createVendorNote(vendorId, input)}
      onUpdateNote={(noteId, input) => updateVendorNote(noteId, input)}
      onTogglePin={(noteId) => toggleVendorNotePin(noteId)}
      readOnly={false}
      onNotesChanged={refetch}
    />
  );
}
