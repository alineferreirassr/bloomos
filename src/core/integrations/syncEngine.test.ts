import { beforeEach, describe, expect, it } from "vitest";
import {
  completeSyncRun,
  detectConflict,
  failSyncRun,
  getSyncCheckpoint,
  listConflictsForConnection,
  listSyncRunsForConnection,
  resetSyncEngine,
  startSyncRun,
  updateSyncCheckpoint,
} from "@/core/integrations/syncEngine";

beforeEach(() => {
  resetSyncEngine();
});

describe("updateSyncCheckpoint / getSyncCheckpoint", () => {
  it("creates then updates a checkpoint's cursor in place", () => {
    updateSyncCheckpoint("conn_1", "cursor-1");
    const updated = updateSyncCheckpoint("conn_1", "cursor-2");
    expect(updated.cursor).toBe("cursor-2");
    expect(getSyncCheckpoint("conn_1")?.cursor).toBe("cursor-2");
  });
});

describe("startSyncRun / completeSyncRun / failSyncRun", () => {
  it("completes a run with no conflicts as succeeded", () => {
    const run = startSyncRun("conn_1", "incremental");
    expect(run.status).toBe("running");
    const completed = completeSyncRun(run.id, 42);
    expect(completed?.status).toBe("succeeded");
    expect(completed?.records_processed).toBe(42);
  });

  it("completing a run with detected conflicts resolves to conflict status, not succeeded", () => {
    const run = startSyncRun("conn_1", "full");
    detectConflict(run.id, "conn_1", "invoice:inv_1", "2026-01-02T00:00:00.000Z", "2026-01-01T00:00:00.000Z");
    const completed = completeSyncRun(run.id, 10);
    expect(completed?.status).toBe("conflict");
    expect(completed?.conflicts_detected).toBe(1);
  });

  it("marks a run failed with an error message", () => {
    const run = startSyncRun("conn_1", "incremental");
    const failed = failSyncRun(run.id, "remote unreachable");
    expect(failed?.status).toBe("failed");
    expect(failed?.error).toBe("remote unreachable");
  });
});

describe("detectConflict", () => {
  it("resolves last-write-wins by comparing timestamps", () => {
    const run = startSyncRun("conn_1", "incremental");
    const localWins = detectConflict(run.id, "conn_1", "invoice:1", "2026-02-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z");
    expect(localWins.resolution).toBe("local_wins");
    expect(localWins.resolved_at).not.toBeNull();

    const remoteWins = detectConflict(run.id, "conn_1", "invoice:2", "2026-01-01T00:00:00.000Z", "2026-02-01T00:00:00.000Z");
    expect(remoteWins.resolution).toBe("remote_wins");

    const tie = detectConflict(run.id, "conn_1", "invoice:3", "2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z");
    expect(tie.resolution).toBe("unresolved");
    expect(tie.resolved_at).toBeNull();
  });

  it("listSyncRunsForConnection / listConflictsForConnection scope by connection", () => {
    startSyncRun("conn_1", "incremental");
    startSyncRun("conn_2", "incremental");
    expect(listSyncRunsForConnection("conn_1")).toHaveLength(1);
    const run = startSyncRun("conn_1", "incremental");
    detectConflict(run.id, "conn_1", "x", "2026-01-01T00:00:00.000Z", "2026-01-02T00:00:00.000Z");
    expect(listConflictsForConnection("conn_1")).toHaveLength(1);
    expect(listConflictsForConnection("conn_2")).toHaveLength(0);
  });
});
