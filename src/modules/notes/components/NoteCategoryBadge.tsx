import { Badge } from "@/components/ui/Badge";
import { NOTE_CATEGORY_LABELS, type NoteCategory } from "@/core/enums/noteCategory";

export function NoteCategoryBadge({ category }: { category: NoteCategory }) {
  return <Badge tone="neutral">{NOTE_CATEGORY_LABELS[category]}</Badge>;
}
