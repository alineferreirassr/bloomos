import { ActivityFeedList, type ActivityFeedItemData } from "@/modules/dashboard/luxury/components/ActivityFeedList";
import { EmptyState } from "@/components/ui/EmptyState";

/** Checkpoint 36, Step 13 — "Recent Activity" widget for Portal Home, the Client Dashboard's own thin wrapper around the shared `ActivityFeedList` (see that component's own doc comment: one list, three named wrappers — RecentMessagesCard and TeamActivityCard on the Owner Dashboard, this on the Client Dashboard). */
export function ClientRecentActivityCard({ items }: { items: ActivityFeedItemData[] }) {
  if (items.length === 0) return <EmptyState title="No recent activity" description="Comments and updates from your planning team appear here." />;
  return <ActivityFeedList items={items} />;
}
