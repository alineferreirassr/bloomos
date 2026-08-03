"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { ReportsIcon } from "@/components/ui/icons";
import { listAllReportSnapshotsAction } from "@/modules/reporting/reportingActions";
import type { ReportSnapshot, ReportSourceStatus } from "@/types/reporting";

type SnapshotEntry = { snapshot: ReportSnapshot; reportTitle: string };
type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; entries: SnapshotEntry[] };

const STATUS_TONE: Record<ReportSourceStatus, BadgeTone> = { ok: "success", stale: "warning", partial: "warning", unavailable: "danger" };

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function overallStatus(diagnostics: ReportSnapshot["diagnostics"]): ReportSourceStatus {
  if (diagnostics.some((d) => d.status === "unavailable")) return "unavailable";
  if (diagnostics.some((d) => d.status === "partial" || d.status === "stale")) return "partial";
  return "ok";
}

/**
 * v2.0 Checkpoint 42, Step 15 — cross-report Snapshot browsing at
 * `/reports/snapshots`. Every row is an already-persisted, immutable
 * `ReportSnapshot` (Step 6) — this view only lists and links, it never
 * regenerates or edits one.
 */
export function ReportSnapshotsView() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    listAllReportSnapshotsAction().then((result) => {
      if (result.success) setState({ status: "ready", entries: result.data });
      else setState({ status: "error", message: result.error });
    });
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Snapshots" subtitle="Immutable point-in-time captures of your reports." icon={ReportsIcon} />

      {state.status === "loading" ? <TableSkeleton rows={6} columns={4} /> : null}
      {state.status === "error" ? <ErrorState message={state.message} /> : null}
      {state.status === "ready" && state.entries.length === 0 ? (
        <EmptyState title="No snapshots yet" description="Generate a snapshot from any report's detail page." />
      ) : null}
      {state.status === "ready" && state.entries.length > 0 ? (
        <div className="flex flex-col gap-3">
          {state.entries.map(({ snapshot, reportTitle }) => (
            <Link key={snapshot.id} href={`/reports/${snapshot.report_id}`}>
              <Card className="flex items-center justify-between p-4 transition hover:border-accent">
                <div>
                  <p className="font-medium">{reportTitle}</p>
                  <p className="text-xs text-text-muted">Generated {formatDateTime(snapshot.generated_at)}</p>
                </div>
                <Badge tone={STATUS_TONE[overallStatus(snapshot.diagnostics)]}>{overallStatus(snapshot.diagnostics)}</Badge>
              </Card>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
