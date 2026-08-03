import { Badge } from "@/components/ui/Badge";

/** Marks the one published row matching `Service.current_published_version_id` — the version new Event assignments default to. An older, superseded published version never gets this badge, even though it's still fully inspectable. */
export function LatestPublishedBadge() {
  return <Badge tone="accent">Latest published</Badge>;
}
