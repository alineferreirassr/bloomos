import type { NoteCategory } from "@/core/enums/noteCategory";
import type { NotePriority } from "@/core/enums/notePriority";

export interface LeadNote {
  id: string;
  lead_id: string;
  title: string;
  content: string;
  category: NoteCategory;
  priority: NotePriority;
  is_pinned: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}
