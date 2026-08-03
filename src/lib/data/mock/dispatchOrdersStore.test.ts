import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockDispatchOrdersRepository, resetDispatchOrdersStore, type CreateDispatchOrderInput } from "@/lib/data/mock/dispatchOrdersStore";

function baseInput(overrides: Partial<CreateDispatchOrderInput> = {}): CreateDispatchOrderInput {
  return {
    execution_package_id: "execution_package_1",
    execution_version_id: "execution_version_1",
    batch_id: null,
    priority: "medium",
    source: "execution_package_derived",
    assignments: [{ resource_type: "worker", resource_id: "worker_1", requirement_line_index: 0 }],
    ...overrides,
  };
}

beforeEach(() => resetDispatchOrdersStore());
afterEach(() => resetDispatchOrdersStore());

describe("mockDispatchOrdersRepository", () => {
  it("creates an order as draft with queued assignments", async () => {
    const result = await mockDispatchOrdersRepository.createOrder("ws_1", "member_1", baseInput());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("draft");
      expect(result.data.assignments).toHaveLength(1);
      expect(result.data.assignments[0].queue_state).toBe("queued");
      expect(result.data.assignments[0].order_id).toBe(result.data.id);
    }
  });

  it("listOrdersForWorkspace scopes to the workspace and excludes archived by default", async () => {
    const created = await mockDispatchOrdersRepository.createOrder("ws_1", "member_1", baseInput());
    await mockDispatchOrdersRepository.createOrder("ws_2", "member_1", baseInput());
    if (!created.success) return;
    await mockDispatchOrdersRepository.setOrderStatus(created.data.id, "ws_1", "archived");

    const activeOnly = await mockDispatchOrdersRepository.listOrdersForWorkspace("ws_1");
    expect(activeOnly).toHaveLength(0);
    const withArchived = await mockDispatchOrdersRepository.listOrdersForWorkspace("ws_1", true);
    expect(withArchived).toHaveLength(1);
    const ws2 = await mockDispatchOrdersRepository.listOrdersForWorkspace("ws_2");
    expect(ws2).toHaveLength(1);
  });

  it("setOrderStatus records cancelled_at/archived_at appropriately", async () => {
    const created = await mockDispatchOrdersRepository.createOrder("ws_1", "member_1", baseInput());
    if (!created.success) return;

    const cancelled = await mockDispatchOrdersRepository.setOrderStatus(created.data.id, "ws_1", "cancelled");
    expect(cancelled.success).toBe(true);
    if (cancelled.success) expect(cancelled.data.cancelled_at).not.toBeNull();

    const archived = await mockDispatchOrdersRepository.setOrderStatus(created.data.id, "ws_1", "archived");
    if (archived.success) expect(archived.data.archived_at).not.toBeNull();
  });

  it("transitionAssignment appends an attempt and updates queue_state/reason, stamping responded_at only on terminal responses", async () => {
    const created = await mockDispatchOrdersRepository.createOrder("ws_1", "member_1", baseInput());
    if (!created.success) return;
    const assignmentId = created.data.assignments[0].id;

    const assigned = await mockDispatchOrdersRepository.transitionAssignment(created.data.id, "ws_1", assignmentId, "assigned", null);
    expect(assigned.success).toBe(true);
    if (assigned.success) {
      expect(assigned.data.assignments[0].queue_state).toBe("assigned");
      expect(assigned.data.assignments[0].responded_at).toBeNull();
      expect(assigned.data.assignments[0].attempts).toHaveLength(1);
    }

    const declined = await mockDispatchOrdersRepository.transitionAssignment(created.data.id, "ws_1", assignmentId, "declined", "Not available");
    expect(declined.success).toBe(true);
    if (declined.success) {
      expect(declined.data.assignments[0].queue_state).toBe("declined");
      expect(declined.data.assignments[0].reason).toBe("Not available");
      expect(declined.data.assignments[0].responded_at).not.toBeNull();
      expect(declined.data.assignments[0].attempts).toHaveLength(2);
    }
  });

  it("transitionAssignment errors for a nonexistent order or assignment", async () => {
    const missingOrder = await mockDispatchOrdersRepository.transitionAssignment("dispatch_order_missing", "ws_1", "dispatch_assignment_missing", "assigned", null);
    expect(missingOrder.success).toBe(false);

    const created = await mockDispatchOrdersRepository.createOrder("ws_1", "member_1", baseInput());
    if (!created.success) return;
    const missingAssignment = await mockDispatchOrdersRepository.transitionAssignment(created.data.id, "ws_1", "dispatch_assignment_missing", "assigned", null);
    expect(missingAssignment.success).toBe(false);
  });

  it("getOrderById returns null for an order that doesn't exist", async () => {
    expect(await mockDispatchOrdersRepository.getOrderById("dispatch_order_missing")).toBeNull();
  });
});
