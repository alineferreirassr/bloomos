import { Badge } from "@/components/ui/Badge";

export function VipBadge({ isVip }: { isVip: boolean }) {
  if (!isVip) return null;
  return <Badge tone="warning">VIP</Badge>;
}
