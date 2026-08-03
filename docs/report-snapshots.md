# Report Snapshots

`lib/data/core/reporting/snapshotsStore.ts` — an immutable point-in-time capture of a computed report.

```ts
export interface ReportSnapshot {
  id: string;
  report_id: string;
  workspace_id: string;
  definition: ReportDefinition;   // the report's config at the moment of capture
  values: ReportMetricValue[];
  comparison: ReportComparisonResult;
  diagnostics: ReportSourceDiagnostic[];
  source_timestamps: Record<string, string>;
  generated_at: string;
  generated_by_member_id: string;
}
```

## Structurally immutable, not just "please don't edit this"

The store's public surface is:

```ts
createSnapshot(input: CreateSnapshotInput): ReportSnapshot
listSnapshots(workspaceId: string, reportId: string): ReportSnapshot[]
getSnapshot(workspaceId: string, id: string): ReportSnapshot | null
resetSnapshotsStore(): void  // test-only
```

**There is no `updateSnapshot` or `deleteSnapshot` export at all** — not "throws if called," genuinely absent from the module. `snapshotsStore.test.ts` verifies this directly: `expect((snapshotsStore as Record<string, unknown>).updateSnapshot).toBeUndefined()`. A snapshot captures the report's `definition` (its config), computed `values`, `comparison`, and `diagnostics` all together, so a later edit to the live report never silently changes what a past snapshot shows.

## Creating a snapshot

`createReportSnapshotAction(reportId)` (`modules/reporting/reportingActions.ts`) loads the saved report, runs it through the Computation Engine, and persists the full `ComputedReport` plus the report's `definition` as of that moment. Recorded on the Timeline as `report_snapshot_generated`.

## Viewing snapshots

- Per-report: `listReportSnapshotsAction(reportId)`, shown on `ReportDetailView`.
- Cross-workspace: `listAllReportSnapshotsAction()`, powering the dedicated `/reports/snapshots` page — every snapshot ever generated across every report, gated on `reports.snapshots`.

## What this is not

Not a scheduled snapshot system — nothing generates a snapshot automatically on a timer (explicitly forbidden this checkpoint's own Stop Conditions: no background workers/cron). Every snapshot is the direct result of a member clicking "Generate Snapshot."
