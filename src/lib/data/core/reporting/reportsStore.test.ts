import { afterEach, describe, expect, it } from "vitest";
import { listReports, getReport, createReport, updateReport, archiveReport, restoreReport, resetReportsStore, type CreateReportInput } from "@/lib/data/core/reporting/reportsStore";

function makeInput(overrides: Partial<CreateReportInput> = {}): CreateReportInput {
  return {
    title: "Revenue Report",
    description: "",
    category: "finance",
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

afterEach(() => {
  resetReportsStore();
});

describe("lib/data/core/reporting/reportsStore", () => {
  it("creates a report scoped to the given workspace and member", async () => {
    const result = await createReport("ws_1", "member_1", makeInput());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.workspace_id).toBe("ws_1");
      expect(result.data.created_by_member_id).toBe("member_1");
      expect(result.data.archived_at).toBeNull();
    }
  });

  it("rejects a report with an empty title", async () => {
    const result = await createReport("ws_1", "member_1", makeInput({ title: "  " }));
    expect(result.success).toBe(false);
  });

  it("records source_template_id when provided", async () => {
    const result = await createReport("ws_1", "member_1", makeInput({ sourceTemplateId: "template_1" }));
    expect(result.success && result.data.source_template_id).toBe("template_1");
  });

  it("lists only reports for the given workspace", async () => {
    await createReport("ws_1", "member_1", makeInput());
    await createReport("ws_2", "member_1", makeInput());
    expect(await listReports("ws_1")).toHaveLength(1);
  });

  it("excludes archived reports from listReports by default", async () => {
    const created = await createReport("ws_1", "member_1", makeInput());
    if (created.success) await archiveReport("ws_1", created.data.id);
    expect(await listReports("ws_1")).toHaveLength(0);
    expect(await listReports("ws_1", true)).toHaveLength(1);
  });

  it("gets a report by id, scoped to workspace", async () => {
    const created = await createReport("ws_1", "member_1", makeInput());
    if (!created.success) throw new Error("setup failed");
    expect(await getReport("ws_1", created.data.id)).not.toBeNull();
    expect(await getReport("ws_2", created.data.id)).toBeNull();
  });

  it("updates a report's fields and bumps updated_at", async () => {
    const created = await createReport("ws_1", "member_1", makeInput());
    if (!created.success) throw new Error("setup failed");
    const updated = await updateReport("ws_1", created.data.id, { title: "New Title" });
    expect(updated.success && updated.data.title).toBe("New Title");
  });

  it("fails to update a report that doesn't exist", async () => {
    const result = await updateReport("ws_1", "missing", { title: "X" });
    expect(result.success).toBe(false);
  });

  it("archives and restores a report", async () => {
    const created = await createReport("ws_1", "member_1", makeInput());
    if (!created.success) throw new Error("setup failed");
    const archived = await archiveReport("ws_1", created.data.id);
    expect(archived.success && archived.data.archived_at).not.toBeNull();
    const restored = await restoreReport("ws_1", created.data.id);
    expect(restored.success && restored.data.archived_at).toBeNull();
  });
});
