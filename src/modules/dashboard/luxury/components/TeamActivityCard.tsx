import { ActivityFeedList, type ActivityFeedItemData } from "@/modules/dashboard/luxury/components/ActivityFeedList";
import { EmptyState } from "@/components/ui/EmptyState";

/** Checkpoint 19, Step 6/7 — "Team Activity" / "Team Updates." */
export function TeamActivityCard({ items }: { items: ActivityFeedItemData[] }) {
  if (items.length === 0) return <EmptyState title="No team activity yet" description="Activity from your team appears here as it happens." />;
  return <ActivityFeedList items={items} />;
}
