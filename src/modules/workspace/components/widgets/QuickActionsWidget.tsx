import Link from "next/link";
import type { WorkspaceQuickAction } from "@/types/smartWorkspace";

export function QuickActionsWidget({ quickActions }: { quickActions: WorkspaceQuickAction[] }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {quickActions.map((action) => (
        <Link
          key={action.id}
          href={action.href}
          className="flex flex-col gap-0.5 rounded-md border border-border px-3 py-2.5 text-sm transition-colors hover:border-accent hover:bg-accent/5"
        >
          <span className="font-medium text-text">{action.label}</span>
          <span className="text-xs text-text-muted">{action.group}</span>
        </Link>
      ))}
    </div>
  );
}
