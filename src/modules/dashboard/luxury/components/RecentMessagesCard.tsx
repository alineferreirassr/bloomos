import { ActivityFeedList, type ActivityFeedItemData } from "@/modules/dashboard/luxury/components/ActivityFeedList";
import { EmptyState } from "@/components/ui/EmptyState";

/** Checkpoint 19, Step 6 — "Recent Messages," reusing the existing Client Portal messaging system (the only messaging system this codebase has) viewed from the staff side — see `getOwnerDashboardData.ts`'s own doc comment. */
export function RecentMessagesCard({ items }: { items: ActivityFeedItemData[] }) {
  if (items.length === 0) return <EmptyState title="No messages yet" description="Client messages appear here as they arrive." />;
  return <ActivityFeedList items={items} />;
}
