"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { NoteCategoryBadge } from "@/modules/notes/components/NoteCategoryBadge";
import { NotePriorityBadge } from "@/modules/notes/components/NotePriorityBadge";
import { NoteForm } from "@/modules/notes/components/NoteForm";
import type { Note } from "@/types/note";
import type { NoteFormInput } from "@/modules/notes/schema";
import type { DataResult } from "@/lib/data/result";

interface NoteCardProps {
  note: Note;
  onTogglePin: (noteId: string) => void;
  readOnly: boolean;
  pinPending: boolean;
  /** Optional — only entities that have wired edit support pass this. Omitting it hides the Edit affordance entirely, so existing consumers are unaffected. */
  onUpdate?: (noteId: string, input: NoteFormInput) => Promise<DataResult<Note>>;
}

export function NoteCard({ note, onTogglePin, readOnly, pinPending, onUpdate }: NoteCardProps) {
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing && onUpdate) {
    return (
      <Card className={note.is_pinned ? "border-accent" : undefined}>
        <NoteForm
          initialValues={{ title: note.title, content: note.content, category: note.category, priority: note.priority }}
          submitLabel="Save"
          onSubmit={(input) => onUpdate(note.id, input)}
          onSuccess={() => setIsEditing(false)}
          onCancel={() => setIsEditing(false)}
        />
      </Card>
    );
  }

  return (
    <Card className={note.is_pinned ? "border-accent" : undefined}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-text">{note.title}</p>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-text-muted">{note.content}</p>
        </div>
        {!readOnly ? (
          <div className="flex shrink-0 items-center gap-3">
            {onUpdate ? (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                aria-label={`Edit note: ${note.title}`}
                className="text-xs font-medium text-accent hover:underline"
              >
                Edit
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => onTogglePin(note.id)}
              disabled={pinPending}
              aria-label={note.is_pinned ? `Unpin note: ${note.title}` : `Pin note: ${note.title}`}
              className="text-xs font-medium text-accent hover:underline disabled:opacity-50"
            >
              {note.is_pinned ? "Unpin" : "Pin"}
            </button>
          </div>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <NoteCategoryBadge category={note.category} />
        <NotePriorityBadge priority={note.priority} />
        <span className="text-xs text-text-muted">
          {note.created_by} · {new Date(note.created_at).toLocaleDateString()}
          {note.updated_at !== note.created_at ? ` · edited ${new Date(note.updated_at).toLocaleDateString()}` : ""}
        </span>
      </div>
    </Card>
  );
}
