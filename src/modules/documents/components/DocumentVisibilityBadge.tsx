import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { DOCUMENT_VISIBILITY_LABELS, type DocumentVisibility } from "@/core/enums/documentVisibility";

const VISIBILITY_TONES: Record<DocumentVisibility, BadgeTone> = {
  internal: "neutral",
  client: "outline",
  team: "outline",
  client_and_team: "accent",
  restricted: "danger",
};

/** Presentation only — no authentication or access enforcement reads this yet, see docs/permissions.md. */
export function DocumentVisibilityBadge({ visibility }: { visibility: DocumentVisibility }) {
  return <Badge tone={VISIBILITY_TONES[visibility]}>{DOCUMENT_VISIBILITY_LABELS[visibility]}</Badge>;
}
