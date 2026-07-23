import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { ACCOUNT_TYPE_LABELS, type AccountType } from "@/core/enums/accountType";

const TYPE_TONES: Record<AccountType, BadgeTone> = {
  asset: "accent",
  liability: "outline",
  equity: "outline",
  revenue: "accent",
  contra_revenue: "warning",
  cost_of_goods_sold: "neutral",
  operating_expense: "neutral",
  other_income: "accent",
  other_expense: "neutral",
};

export function AccountTypeBadge({ accountType }: { accountType: AccountType }) {
  return <Badge tone={TYPE_TONES[accountType]}>{ACCOUNT_TYPE_LABELS[accountType]}</Badge>;
}
