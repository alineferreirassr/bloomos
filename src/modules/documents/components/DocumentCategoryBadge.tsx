import { Badge } from "@/components/ui/Badge";
import { DOCUMENT_CATEGORY_LABELS, type DocumentCategory } from "@/core/enums/documentCategory";

/** A label, not a lifecycle state — one neutral tone across all 25 categories. */
export function DocumentCategoryBadge({ category }: { category: DocumentCategory }) {
  return <Badge tone="neutral">{DOCUMENT_CATEGORY_LABELS[category]}</Badge>;
}
