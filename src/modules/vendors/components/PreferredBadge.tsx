import { Badge } from "@/components/ui/Badge";

/** Detail-page badge — mirrors VipBadge's shape exactly. */
export function PreferredBadge({ isPreferred }: { isPreferred: boolean }) {
  if (!isPreferred) return null;
  return <Badge tone="accent">Preferred</Badge>;
}
