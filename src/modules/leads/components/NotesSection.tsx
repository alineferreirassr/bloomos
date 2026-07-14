"use client";

import { useState } from "react";
import { createNote, togglePinNote } from "@/lib/data";
import type { LeadNote } from "@/types/note";
import type { NoteFormInput } from "@/modules/leads/schema";
import { NoteCard } from "@/modules/leads/components/NoteCard";
import { NoteForm } from "@/modules/leads/components/NoteForm";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

interface NotesSectionProps {
  leadId: string;
  notes: LeadNote[];
  readOnly: boolean;
  onNotesChanged: () => void;
}

export function NotesSection({ leadId, notes, readOnly, onNotesChanged }: NotesSectionProps) {
  const [showForm, setShowForm] = useState(false);
  const [pendingNoteId, setPendingNoteId] = useState<string | null>(null);

  const pinned = notes.filter((note) => note.is_pinned);
  const rest = notes.filter((note) => !note.is_pinned);

  const handleTogglePin = async (noteId: string) => {
    setPendingNoteId(noteId);
    await togglePinNote(noteId);
    setPendingNoteId(null);
    onNotesChanged();
  };

  return (
    <div className="space-y-6">
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
              onSubmit={(input: NoteFormInput) => createNote(leadId, input)}
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
            <EmptyState title="No notes yet" description="Add the first note for this lead." />
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
