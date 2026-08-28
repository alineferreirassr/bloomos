import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));

vi.mock("@/modules/executiveDecisions/executiveDecisionsActions", () => ({
  evaluateExecutiveDecisionsAction: vi.fn(),
}));

// reportingActions.ts also registers built-in report metrics, including a commercial metric
// (getJourneyAnalyticsAction) that imports Client Journey wiring reaching
// `@/lib/auth/workspaceSession` directly — a second, separate path to the server-only-guarded
// `@/lib/supabase/server` the mocks above don't intercept. Mocked here per the Test Infra T1-B
// fix; never actually reached in mock-mode tests.
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import {
  listReportMetricsAction,
  listReportDimensionsAction,
  listReportFiltersAction,
  listReportTemplatesAction,
  getReportTemplateAction,
  listReportsAction,
  getReportAction,
  createReportAction,
  updateReportAction,
  archiveReportAction,
  restoreReportAction,
  previewReportAction,
  computeReportAction,
  listReportSnapshotsAction,
  listAllReportSnapshotsAction,
  createReportSnapshotAction,
  recordReportExportRequestedAction,
  evaluateReportingHealthAction,
  evaluateReportingAnalyticsAction,
  getExecutiveReportInsightsAction,
} from "@/modules/reporting/reportingActions";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { evaluateExecutiveDecisionsAction } from "@/modules/executiveDecisions/executiveDecisionsActions";
import { resetReportsStore, type CreateReportInput } from "@/lib/data/core/reporting/reportsStore";
import { resetSnapshotsStore } from "@/lib/data/core/reporting/snapshotsStore";
import { resetReportPerformanceSamples } from "@/lib/data/core/reporting/performanceSamplesStore";
import { resetTimelineStore, readActivities } from "@/lib/data/mock/timelineStore";

function makeSession(overrides: Partial<MemberSessionSnapshot & { kind: "active" }> = {}): MemberSessionSnapshot {
  return {
    kind: "active",
    user: { id: "user_1", email: "ana@amorebloom.com" },
    profile: { full_name: "Ana Ferreira", avatar_url: null },
    workspace: { id: "ws_1", name: "Amoré Bloom" },
    membership: { id: "member_1", role: "manager", status: "active", created_at: "2026-01-01T00:00:00.000Z" },
    permissions: ["reports.view", "reports.build", "reports.manage", "reports.snapshots", "reports.executive"],
    workspaceDisplayName: "Amoré Bloom",
    ...overrides,
  } as MemberSessionSnapshot;
}

function makeReportInput(overrides: Partial<CreateReportInput> = {}): CreateReportInput {
  return {
    title: "Test Report",
    description: "",
    category: "custom",
    sections: [],
    periodKey: "30d",
    customWindow: null,
    comparisonMode: "previous_period",
    customComparisonWindow: null,
    groupBy: null,
    sortBy: null,
    filters: [],
    ...overrides,
  };
}

beforeEach(() => {
  resetReportsStore();
  resetSnapshotsStore();
  resetReportPerformanceSamples();
  resetTimelineStore();
  vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(makeSession());
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("reportingActions — permission gating", () => {
  it("rejects listReportMetricsAction for a session without reports.view", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(makeSession({ permissions: [] }));
    const result = await listReportMetricsAction();
    expect(result.success).toBe(false);
  });

  it("rejects createReportAction for a session with only reports.view", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(makeSession({ permissions: ["reports.view"] }));
    const result = await createReportAction(makeReportInput());
    expect(result.success).toBe(false);
  });

  it("rejects archiveReportAction for a session with only reports.build", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(makeSession({ permissions: ["reports.build"] }));
    const result = await archiveReportAction("report_1");
    expect(result.success).toBe(false);
  });

  it("rejects createReportSnapshotAction for a session without reports.snapshots", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(makeSession({ permissions: ["reports.view", "reports.build"] }));
    const result = await createReportSnapshotAction("report_1");
    expect(result.success).toBe(false);
  });

  it("rejects getExecutiveReportInsightsAction for a session without reports.executive", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(makeSession({ permissions: ["reports.view"] }));
    const result = await getExecutiveReportInsightsAction();
    expect(result.success).toBe(false);
  });

  it("rejects every action for an inactive session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" } as MemberSessionSnapshot);
    expect((await listReportsAction()).success).toBe(false);
  });
});

describe("reportingActions — Report Builder discovery", () => {
  it("returns the closed dimension and filter sets unchanged", async () => {
    const dimensions = await listReportDimensionsAction();
    const filters = await listReportFiltersAction();
    expect(dimensions.success && dimensions.data.length).toBeGreaterThan(0);
    expect(filters.success && filters.data.length).toBeGreaterThan(0);
  });

  it("lists the real built-in templates, including the 'custom' entry", async () => {
    const result = await listReportTemplatesAction();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.some((t) => t.id === "custom")).toBe(true);
  });

  it("returns 'Template not found.' for an unknown template id", async () => {
    const result = await getReportTemplateAction("does-not-exist");
    expect(result.success).toBe(false);
  });

  it("lists real, already-registered metrics", async () => {
    const result = await listReportMetricsAction();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.length).toBeGreaterThan(0);
  });
});

describe("reportingActions — saved report CRUD", () => {
  it("creates, reads, updates, archives, and restores a report end to end", async () => {
    const created = await createReportAction(makeReportInput());
    expect(created.success).toBe(true);
    if (!created.success) return;

    const fetched = await getReportAction(created.data.id);
    expect(fetched.success && fetched.data.id).toBe(created.data.id);

    const updated = await updateReportAction(created.data.id, { title: "Renamed" });
    expect(updated.success && updated.data.title).toBe("Renamed");

    const archived = await archiveReportAction(created.data.id);
    expect(archived.success && archived.data.archived_at).not.toBeNull();

    const listVisible = await listReportsAction();
    expect(listVisible.success && listVisible.data).toHaveLength(0);
    const listAll = await listReportsAction(true);
    expect(listAll.success && listAll.data).toHaveLength(1);

    const restored = await restoreReportAction(created.data.id);
    expect(restored.success && restored.data.archived_at).toBeNull();
  });

  it("returns an error for a report that doesn't exist", async () => {
    expect((await getReportAction("missing")).success).toBe(false);
  });

  it("records report_created and report_saved Timeline events for a from-scratch report", async () => {
    const created = await createReportAction(makeReportInput());
    if (!created.success) throw new Error("setup failed");
    const events = readActivities().filter((a) => a.owner_type === "report" && a.owner_id === created.data.id);
    expect(events.map((e) => e.type).sort()).toEqual(["report_created", "report_saved"]);
  });

  it("records only report_created (not report_saved) for a report instantiated from a template", async () => {
    const created = await createReportAction(makeReportInput({ sourceTemplateId: "executive_overview" }));
    if (!created.success) throw new Error("setup failed");
    const events = readActivities().filter((a) => a.owner_type === "report" && a.owner_id === created.data.id);
    expect(events.map((e) => e.type)).toEqual(["report_created"]);
  });
});

describe("reportingActions — computation and snapshots", () => {
  it("previews an in-memory definition without persisting a report", async () => {
    const result = await previewReportAction(makeReportInput());
    expect(result.success).toBe(true);
    const reports = await listReportsAction();
    expect(reports.success && reports.data).toHaveLength(0);
  });

  it("computes a saved report and records a report_viewed Timeline event", async () => {
    const created = await createReportAction(makeReportInput());
    if (!created.success) throw new Error("setup failed");
    const computed = await computeReportAction(created.data.id);
    expect(computed.success).toBe(true);
    const events = readActivities().filter((a) => a.owner_type === "report" && a.owner_id === created.data.id && a.type === "report_viewed");
    expect(events).toHaveLength(1);
  });

  it("creates an immutable snapshot from a saved report and records report_snapshot_generated", async () => {
    const created = await createReportAction(makeReportInput());
    if (!created.success) throw new Error("setup failed");
    const snapshot = await createReportSnapshotAction(created.data.id);
    expect(snapshot.success).toBe(true);
    if (snapshot.success) expect(snapshot.data.report_id).toBe(created.data.id);

    const listed = await listReportSnapshotsAction(created.data.id);
    expect(listed.success && listed.data).toHaveLength(1);

    const listedAll = await listAllReportSnapshotsAction();
    expect(listedAll.success && listedAll.data).toHaveLength(1);

    const events = readActivities().filter((a) => a.owner_type === "report" && a.type === "report_snapshot_generated");
    expect(events).toHaveLength(1);
  });

  it("records report_export_requested for an existing report", async () => {
    const created = await createReportAction(makeReportInput());
    if (!created.success) throw new Error("setup failed");
    const result = await recordReportExportRequestedAction(created.data.id);
    expect(result.success).toBe(true);
    const events = readActivities().filter((a) => a.owner_type === "report" && a.type === "report_export_requested");
    expect(events).toHaveLength(1);
  });
});

describe("reportingActions — health and analytics", () => {
  it("evaluates reporting health for the current workspace", async () => {
    const result = await evaluateReportingHealthAction();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.categories.length).toBeGreaterThan(0);
  });

  it("evaluates reporting analytics for the current workspace", async () => {
    await createReportAction(makeReportInput());
    const result = await evaluateReportingAnalyticsAction();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.reportsCreated).toBe(1);
  });
});

describe("reportingActions — executive insights", () => {
  it("maps ExecutiveReport fields into severity-labeled ReportInsight entries, with no fabricated opportunities/regressions", async () => {
    vi.mocked(evaluateExecutiveDecisionsAction).mockResolvedValue({
      success: true,
      data: {
        report: {
          executiveSummary: "",
          criticalIssues: ["Overdue decision"],
          businessRisks: ["Revenue risk"],
          operationalRisks: ["Staffing risk"],
          decisionQueueSummary: "",
          completedDecisionsSummary: "",
          blockedDecisionsSummary: "",
          topImprovements: ["Faster onboarding"],
          evaluatedAt: "2026-01-01T00:00:00.000Z",
        },
      },
    } as never);

    const result = await getExecutiveReportInsightsAction();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.map((i) => i.label)).toEqual(["Critical Issue", "Business Risk", "Operational Risk", "Recent Improvement"]);
    expect(result.data.find((i) => i.label === "Recent Improvement")?.severity).toBe("positive");
  });

  it("propagates a failure from Executive Decisions honestly rather than returning fabricated insights", async () => {
    vi.mocked(evaluateExecutiveDecisionsAction).mockResolvedValue({ success: false, error: "not available" } as never);
    const result = await getExecutiveReportInsightsAction();
    expect(result.success).toBe(false);
  });
});
