import { EmptyState } from "@/components/ui/EmptyState";

/** Defensive only — every Service is created with a draft, so `rows` should never genuinely be empty. */
export function VersionHistoryEmptyState() {
  return <EmptyState title="No versions yet" description="This Service doesn't have any version history yet." />;
}
