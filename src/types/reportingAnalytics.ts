/**
 * v2.0 Checkpoint 42 — internal Reporting Platform usage analytics. Tracks
 * usage of the Reporting Platform itself (reports created/viewed/saved,
 * templates used, snapshots generated) — never a second copy of any
 * domain metric's own analytics (Search/Notification/Workflow/DAM
 * Analytics stay exactly as they are). "Do not create invasive user
 * tracking" (the checkpoint's own words): every count here is workspace-
 * scoped and aggregate — no per-member browsing history is exposed by
 * this type.
 */
export interface ReportingUsageRanking {
  key: string;
  label: string;
  count: number;
}

export interface ReportingAnalytics {
  reportsCreated: number;
  reportsViewed: number;
  reportsSaved: number;
  reportsFavorited: number;
  reportsPinned: number;
  templatesUsed: number;
  snapshotsGenerated: number;
  mostViewedReports: ReportingUsageRanking[];
  mostUsedMetrics: ReportingUsageRanking[];
  mostUsedFilters: ReportingUsageRanking[];
  noDataReports: number;
  failedReportSources: number;
  averageGenerationTimeMs: number | null;
  evaluatedAt: string;
}
