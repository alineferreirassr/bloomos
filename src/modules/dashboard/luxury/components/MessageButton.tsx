"use client";

import { IconBadgeButton } from "@/modules/dashboard/luxury/components/IconBadgeButton";
import { LuxuryMessageIcon } from "@/modules/dashboard/luxury/luxuryIcons";

/** `count` is the real unread-thread count from the existing Client Portal messaging system (`getUnreadClientPortalThreadCountForWorkspace`) — the only messaging system that exists in this codebase; see docs/luxury-design-system.md's Known limitations. */
export function MessageButton({ count, onClick }: { count: number; onClick?: () => void }) {
  return <IconBadgeButton icon={<LuxuryMessageIcon className="h-5 w-5" />} count={count} label="unread messages" onClick={onClick} />;
}
