import { Card } from "@/components/ui/Card";
import { NoteCategoryBadge } from "@/modules/leads/components/NoteCategoryBadge";
import { NotePriorityBadge } from "@/modules/leads/components/NotePriorityBadge";
import type { LeadNote } from "@/types/note";

interface NoteCardProps {
  note: LeadNote;
  onTogglePin: (noteId: string) => void;
  readOnly: boolean;
  pinPending: boolean;
}

export function NoteCard({ note, onTogglePin, readOnly, pinPending }: NoteCardProps) {
  return (
    <Card className={note.is_pinned ? "border-accent" : undefined}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-text">{note.title}</p>
          <p className="mt-1 text-sm text-text-muted">{note.content}</p>
        </div>
        {!readOnly ? (
          <button
            type="button"
            onClick={() => onTogglePin(note.id)}
            disabled={pinPending}
            className="shrink-0 text-xs font-medium text-accent hover:underline disabled:opacity-50"
          >
            {note.is_pinned ? "Unpin" : "Pin"}
          </button>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <NoteCategoryBadge category={note.category} />
        <NotePriorityBadge priority={note.priority} />
        <span className="text-xs text-text-muted">
          {note.created_by} · {new Date(note.created_at).toLocaleDateString()}
        </span>
      </div>
    </Card>
  );
}
