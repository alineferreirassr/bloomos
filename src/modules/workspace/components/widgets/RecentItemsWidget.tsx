import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import type { WorkspaceRecentItem } from "@/types/smartWorkspace";

export function RecentItemsWidget({ recentItems }: { recentItems: WorkspaceRecentItem[] }) {
  if (recentItems.length === 0) {
    return <EmptyState title="Nothing opened yet" description="Entities you view across BloomOS will show up here." />;
  }

  return (
    <ul className="flex flex-col gap-2">
      {recentItems.slice(0, 8).map((item) => (
        <li key={item.id}>
          <Link href={item.href} className="truncate text-sm font-medium text-text hover:text-accent">
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
