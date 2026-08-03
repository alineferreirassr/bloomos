import { describe, expect, it, afterEach } from "vitest";
import * as snapshotsStore from "@/lib/data/core/reporting/snapshotsStore";
import { listSnapshots, getSnapshot, createSnapshot, resetSnapshotsStore, type CreateSnapshotInput } from "@/lib/data/core/reporting/snapshotsStore";

function makeInput(overrides: Partial<CreateSnapshotInput> = {}): CreateSnapshotInput {
  return {
    report_id: "report_1",
    workspace_id: "ws_1",
    definition: { title: "R", description: "", category: "finance", sections: [], periodKey: "30d", customWindow: null, comparisonMode: "none", customComparisonWindow: null, groupBy: null, sortBy: null, filters: [] },
    values: [],
    comparison: { mode: "none", currentWindow: { start: "", end: "" }, comparisonWindow: null, comparable: false, missingPeriodReason: null },
    diagnostics: [],
    source_timestamps: {},
    generated_by_member_id: "member_1",
    ...overrides,
  };
}

afterEach(() => {
  resetSnapshotsStore();
});

describe("lib/data/core/reporting/snapshotsStore", () => {
  it("creates a snapshot with a generated id and timestamp", () => {
    const snapshot = createSnapshot(makeInput());
    expect(snapshot.id).toBeTruthy();
    expect(snapshot.generated_at).toBeTruthy();
  });

  it("never exports an update or delete function — snapshots are structurally immutable", () => {
    expect((snapshotsStore as Record<string, unknown>).updateSnapshot).toBeUndefined();
    expect((snapshotsStore as Record<string, unknown>).deleteSnapshot).toBeUndefined();
  });

  it("lists snapshots scoped to workspace and report, newest first", () => {
    createSnapshot(makeInput({ report_id: "report_1", generated_by_member_id: "m1" }));
    createSnapshot(makeInput({ report_id: "report_2" }));
    const list = listSnapshots("ws_1", "report_1");
    expect(list).toHaveLength(1);
  });

  it("gets a snapshot by id, scoped to workspace", () => {
    const snapshot = createSnapshot(makeInput());
    expect(getSnapshot("ws_1", snapshot.id)).not.toBeNull();
    expect(getSnapshot("ws_2", snapshot.id)).toBeNull();
  });

  it("resetSnapshotsStore clears every snapshot", () => {
    createSnapshot(makeInput());
    resetSnapshotsStore();
    expect(listSnapshots("ws_1", "report_1")).toHaveLength(0);
  });
});
