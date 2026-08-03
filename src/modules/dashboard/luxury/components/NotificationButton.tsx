"use client";

import { IconBadgeButton } from "@/modules/dashboard/luxury/components/IconBadgeButton";
import { LuxuryBellIcon } from "@/modules/dashboard/luxury/luxuryIcons";

/** `count` is always a real, caller-computed number (overdue checklist items, pending approvals — see each dashboard aggregator's own doc comment for its exact source) — never a hardcoded placeholder. */
export function NotificationButton({ count, onClick }: { count: number; onClick?: () => void }) {
  return <IconBadgeButton icon={<LuxuryBellIcon className="h-5 w-5" />} count={count} label="notifications" onClick={onClick} />;
}
