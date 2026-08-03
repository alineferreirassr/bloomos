import { beforeEach, describe, expect, it } from "vitest";
import { resetFieldOperationsStore, mockFieldOperationsRepository, type CreateFieldOperationInput } from "@/lib/data/mock/fieldOperationsStore";

function baseInput(overrides: Partial<CreateFieldOperationInput> = {}): CreateFieldOperationInput {
  return { dispatch_order_id: "dispatch_order_1", dispatch_assignment_id: "assignment_1", execution_package_id: "package_1", execution_version_id: "version_1", priority: "medium", context: { nodeType: "event", nodeId: "event_1" }, ...overrides };
}

beforeEach(() => {
  resetFieldOperationsStore();
});

describe("fieldOperationsStore", () => {
  it("creates a field operation with one initial session in the created state", async () => {
    const result = await mockFieldOperationsRepository.createOperation("ws_1", "member_1", baseInput());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("active");
    expect(result.data.sessions).toHaveLength(1);
    expect(result.data.sessions[0].lifecycle_state).toBe("created");
    expect(result.data.sessions[0].attempts).toHaveLength(0);
  });

  it("lists operations for a workspace, excluding archived by default", async () => {
    const created = await mockFieldOperationsRepository.createOperation("ws_1", "member_1", baseInput());
    if (!created.success) throw new Error("failed to create");
    await mockFieldOperationsRepository.setOperationStatus(created.data.id, "ws_1", "archived");

    const activeOnly = await mockFieldOperationsRepository.listOperationsForWorkspace("ws_1");
    expect(activeOnly).toHaveLength(0);
    const withArchived = await mockFieldOperationsRepository.listOperationsForWorkspace("ws_1", true);
    expect(withArchived).toHaveLength(1);
  });

  it("gets an operation by id, and errors for one that doesn't exist", async () => {
    const created = await mockFieldOperationsRepository.createOperation("ws_1", "member_1", baseInput());
    if (!created.success) throw new Error("failed to create");
    const fetched = await mockFieldOperationsRepository.getOperationById(created.data.id);
    expect(fetched?.id).toBe(created.data.id);
    expect(await mockFieldOperationsRepository.getOperationById("field_operation_missing")).toBeNull();
  });

  it("transitions a session and appends an attempt, stamping started_at on the started transition", async () => {
    const created = await mockFieldOperationsRepository.createOperation("ws_1", "member_1", baseInput());
    if (!created.success) throw new Error("failed to create");
    const sessionId = created.data.sessions[0].id;

    const result = await mockFieldOperationsRepository.transitionSession(created.data.id, "ws_1", sessionId, "started", null);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const session = result.data.sessions[0];
    expect(session.lifecycle_state).toBe("started");
    expect(session.started_at).not.toBeNull();
    expect(session.attempts).toHaveLength(1);
    expect(session.attempts[0].lifecycle_state).toBe("started");
  });

  it("stamps outcome + completed_at only once a terminal state is reached", async () => {
    const created = await mockFieldOperationsRepository.createOperation("ws_1", "member_1", baseInput());
    if (!created.success) throw new Error("failed to create");
    const sessionId = created.data.sessions[0].id;

    await mockFieldOperationsRepository.transitionSession(created.data.id, "ws_1", sessionId, "started", null);
    const result = await mockFieldOperationsRepository.transitionSession(created.data.id, "ws_1", sessionId, "completed", null);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const session = result.data.sessions[0];
    expect(session.outcome).toBe("completed");
    expect(session.completed_at).not.toBeNull();
  });

  it("records a reason on a cancel/abort/fail transition", async () => {
    const created = await mockFieldOperationsRepository.createOperation("ws_1", "member_1", baseInput());
    if (!created.success) throw new Error("failed to create");
    const sessionId = created.data.sessions[0].id;

    const result = await mockFieldOperationsRepository.transitionSession(created.data.id, "ws_1", sessionId, "cancelled", "Client rescheduled");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.sessions[0].reason).toBe("Client rescheduled");
    expect(result.data.sessions[0].outcome).toBe("cancelled");
  });

  it("starts a new session on the same field operation without touching the prior one", async () => {
    const created = await mockFieldOperationsRepository.createOperation("ws_1", "member_1", baseInput());
    if (!created.success) throw new Error("failed to create");
    const firstSessionId = created.data.sessions[0].id;
    await mockFieldOperationsRepository.transitionSession(created.data.id, "ws_1", firstSessionId, "cancelled", "Retry needed");

    const restarted = await mockFieldOperationsRepository.startNewSession(created.data.id, "ws_1");
    expect(restarted.success).toBe(true);
    if (!restarted.success) return;
    expect(restarted.data.sessions).toHaveLength(2);
    expect(restarted.data.sessions[0].lifecycle_state).toBe("cancelled");
    expect(restarted.data.sessions[1].lifecycle_state).toBe("created");
  });

  it("updates a session's progress overlay without altering its lifecycle_state", async () => {
    const created = await mockFieldOperationsRepository.createOperation("ws_1", "member_1", baseInput());
    if (!created.success) throw new Error("failed to create");
    const sessionId = created.data.sessions[0].id;

    const result = await mockFieldOperationsRepository.updateSessionProgress(created.data.id, "ws_1", sessionId, { current_phase_id: "phase_1", completed_step_ids: ["step_1"] });
    expect(result.success).toBe(true);
    if (!result.success) return;
    const session = result.data.sessions[0];
    expect(session.current_phase_id).toBe("phase_1");
    expect(session.completed_step_ids).toEqual(["step_1"]);
    expect(session.lifecycle_state).toBe("created");
  });

  it("errors when transitioning a session on an operation that doesn't exist", async () => {
    const result = await mockFieldOperationsRepository.transitionSession("field_operation_missing", "ws_1", "session_missing", "started", null);
    expect(result.success).toBe(false);
  });

  it("errors when transitioning a session that doesn't exist on a real operation", async () => {
    const created = await mockFieldOperationsRepository.createOperation("ws_1", "member_1", baseInput());
    if (!created.success) throw new Error("failed to create");
    const result = await mockFieldOperationsRepository.transitionSession(created.data.id, "ws_1", "session_missing", "started", null);
    expect(result.success).toBe(false);
  });
});
