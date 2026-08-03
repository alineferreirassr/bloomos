import { describe, it, expect } from "vitest";
import { isRequestOverdue, effectiveStatus, summarizeRequests, toClientFacing } from "./informationRequestEngine";
import type { ClientInformationRequest } from "@/types/clientJourney";

const NOW = "2026-02-01T00:00:00.000Z";

function request(overrides: Partial<ClientInformationRequest> = {}): ClientInformationRequest {
  return {
    id: "req_1",
    workspaceId: "workspace_1",
    clientId: "client_1",
    title: "Please share dietary restrictions",
    description: "",
    requiredFields: [],
    requiredDocuments: [],
    dueDate: null,
    status: "pending",
    clientResponse: null,
    internalNotes: "Internal-only note",
    relatedJourneyStage: null,
    relatedEventId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    fulfilledAt: null,
    ...overrides,
  };
}

describe("isRequestOverdue / effectiveStatus", () => {
  it("is not overdue with no due date", () => {
    expect(isRequestOverdue(request({ dueDate: null }), NOW)).toBe(false);
  });

  it("is overdue once the due date has passed and it's still pending", () => {
    expect(isRequestOverdue(request({ dueDate: "2026-01-15" }), NOW)).toBe(true);
  });

  it("a fulfilled request is never reported as overdue even with a past due date", () => {
    expect(isRequestOverdue(request({ dueDate: "2026-01-15", status: "fulfilled" }), NOW)).toBe(false);
  });

  it("effectiveStatus computes overdue live rather than trusting a stored flag", () => {
    expect(effectiveStatus(request({ dueDate: "2026-01-15", status: "pending" }), NOW)).toBe("overdue");
  });
});

describe("summarizeRequests", () => {
  it("buckets requests by their effective (live-computed) status", () => {
    const summary = summarizeRequests([request({ dueDate: "2026-01-15" }), request({ status: "fulfilled" }), request({ status: "pending", dueDate: null })], NOW);
    expect(summary).toEqual({ pending: 1, overdue: 1, fulfilled: 1, cancelled: 0 });
  });
});

describe("toClientFacing", () => {
  it("never leaks internalNotes to the client-facing projection", () => {
    const facing = toClientFacing(request(), NOW);
    expect(facing).not.toHaveProperty("internalNotes");
    expect(JSON.stringify(facing)).not.toContain("Internal-only note");
  });
});
