import { Badge } from "@/components/ui/Badge";

/** Marks the one draft row every Service always has — distinct from `VersionBadge`'s generic "Draft" status label, this specifically calls out "this is the version you're actively editing right now." */
export function CurrentVersionBadge() {
  return <Badge tone="outline">Currently editing</Badge>;
}
