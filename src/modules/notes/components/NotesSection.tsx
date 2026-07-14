"use client";

import { useState } from "react";
import type { Note } from "@/types/note";
import type { NoteFormInput } from "@/modules/notes/schema";
import type { DataResult } from "@/lib/data/result";
import type { EntityType } from "@/core/enums/entityType";
import { NoteCard } from "@/modules/notes/components/NoteCard";
import { NoteForm } from "@/modules/notes/components/NoteForm";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

const OWNER_LABEL: Record<EntityType, string> = {
  lead: "Lead",
  client: "Client",
};

/**
 * Generic — owns no Lead or Client business logic itself. The caller injects
 * the actual mutations (onCreateNote/onTogglePin), already scoped to the
 * right owner and workspace by the data layer, so Lead and future Client
 * screens compose this same implementation instead of forking it.
 */
interface NotesSectionProps {
  workspaceId: string;
  ownerType: EntityType;
  ownerId: string;
  notes: Note[];
  onCreateNote: (input: NoteFormInput) => Promise<DataResult<Note>>;
  onTogglePin: (noteId: string) => Promise<DataResult<Note>>;
  readOnly: boolean;
  onNotesChanged: () => void;
}

export function NotesSection({
  workspaceId,
  ownerType,
  ownerId,
  notes,
  onCreateNote,
  onTogglePin,
  readOnly,
  onNotesChanged,
}: NotesSectionProps) {
  const [showForm, setShowForm] = useState(false);
  const [pendingNoteId, setPendingNoteId] = useState<string | null>(null);
  const ownerLabel = OWNER_LABEL[ownerType];

  const pinned = notes.filter((note) => note.is_pinned);
  const rest = notes.filter((note) => !note.is_pinned);

  const handleTogglePin = async (noteId: string) => {
    setPendingNoteId(noteId);
    await onTogglePin(noteId);
    setPendingNoteId(null);
    onNotesChanged();
  };

  return (
    <div className="space-y-6" data-workspace-id={workspaceId} data-owner-type={ownerType} data-owner-id={ownerId}>
      {pinned.length > 0 ? (
        <div>
          <h3 className="text-sm font-medium text-text-muted">Pinned notes</h3>
          <div className="mt-2 space-y-3">
            {pinned.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onTogglePin={handleTogglePin}
                readOnly={readOnly}
                pinPending={pendingNoteId === note.id}
              />
            ))}
          </div>
        </div>
      ) : null}

      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-text-muted">All notes</h3>
          {!readOnly && !showForm ? (
            <Button variant="secondary" onClick={() => setShowForm(true)}>
              Add note
            </Button>
          ) : null}
        </div>

        {showForm ? (
          <div className="mt-3">
            <NoteForm
              onSubmit={onCreateNote}
              onSuccess={() => {
                setShowForm(false);
                onNotesChanged();
              }}
              onCancel={() => setShowForm(false)}
            />
          </div>
        ) : null}

        <div className="mt-3 space-y-3">
          {rest.length === 0 && pinned.length === 0 && !showForm ? (
            <EmptyState title="No notes yet" description={`Add the first note for this ${ownerLabel}.`} />
          ) : (
            rest.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onTogglePin={handleTogglePin}
                readOnly={readOnly}
                pinPending={pendingNoteId === note.id}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
