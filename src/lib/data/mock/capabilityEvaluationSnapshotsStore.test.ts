import { beforeEach, describe, expect, it } from "vitest";
import { getEvaluationSnapshot, setEvaluationSnapshot, listEvaluationSnapshotsForRequirement, resetCapabilityEvaluationSnapshotsStore } from "@/lib/data/mock/capabilityEvaluationSnapshotsStore";

beforeEach(() => resetCapabilityEvaluationSnapshotsStore());

describe("capabilityEvaluationSnapshotsStore", () => {
  it("returns null for a snapshot that was never recorded", () => {
    expect(getEvaluationSnapshot("req_1", "worker_1")).toBeNull();
  });

  it("stores and retrieves a snapshot keyed by requirement + worker", () => {
    setEvaluationSnapshot({ requirementId: "req_1", workerId: "worker_1", state: "eligible", overallCapabilityScore: 90 });
    expect(getEvaluationSnapshot("req_1", "worker_1")).toEqual({ requirementId: "req_1", workerId: "worker_1", state: "eligible", overallCapabilityScore: 90 });
    expect(getEvaluationSnapshot("req_1", "worker_2")).toBeNull();
  });

  it("overwrites the prior snapshot for the same key", () => {
    setEvaluationSnapshot({ requirementId: "req_1", workerId: "worker_1", state: "eligible", overallCapabilityScore: 90 });
    setEvaluationSnapshot({ requirementId: "req_1", workerId: "worker_1", state: "ineligible", overallCapabilityScore: 0 });
    expect(getEvaluationSnapshot("req_1", "worker_1")?.state).toBe("ineligible");
  });

  it("listEvaluationSnapshotsForRequirement scopes by requirement", () => {
    setEvaluationSnapshot({ requirementId: "req_1", workerId: "worker_1", state: "eligible", overallCapabilityScore: 90 });
    setEvaluationSnapshot({ requirementId: "req_1", workerId: "worker_2", state: "ineligible", overallCapabilityScore: 0 });
    setEvaluationSnapshot({ requirementId: "req_2", workerId: "worker_1", state: "eligible", overallCapabilityScore: 80 });
    expect(listEvaluationSnapshotsForRequirement("req_1")).toHaveLength(2);
  });
});
