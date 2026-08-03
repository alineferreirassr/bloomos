import Link from "next/link";
import type { WorkspaceReportsSummary } from "@/modules/workspace/workspaceActions";

/** v2.0 Checkpoint 42, Step 16 — Smart Workspace extension: links through to the Reporting Center, never a second reports list. */
export function ReportsOverviewWidget({ reportsSummary }: { reportsSummary: WorkspaceReportsSummary | null }) {
  if (!reportsSummary || reportsSummary.totalReports === 0) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-text-muted">No reports yet.</p>
        <Link href="/reports/templates" className="text-xs font-medium text-accent hover:underline">
          Browse templates →
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {reportsSummary.recentReports.map((report) => (
        <Link key={report.id} href={`/reports/${report.id}`} className="flex items-center justify-between text-sm hover:underline">
          <span>{report.title}</span>
        </Link>
      ))}
      <Link href="/reports" className="mt-1 text-xs font-medium text-accent hover:underline">
        View all {reportsSummary.totalReports} reports →
      </Link>
    </div>
  );
}
