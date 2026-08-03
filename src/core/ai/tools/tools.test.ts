import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { registerAITool, getAITool, listAITools, resetAIToolRegistry } from "@/core/ai/tools/registry";
import { executeAITool } from "@/core/ai/tools/executeTool";
import type { AIToolDefinition, AIToolExecutionContext } from "@/core/ai/tools/types";

function baseContext(overrides: Partial<AIToolExecutionContext> = {}): AIToolExecutionContext {
  return { workspaceId: "ws-1", userId: "user-1", permissions: [], ...overrides };
}

function makeTool(overrides: Partial<AIToolDefinition> = {}): AIToolDefinition {
  return {
    toolId: "reschedule-event",
    description: "Reschedules an Event to a new date.",
    inputSchema: z.object({ eventId: z.string(), newDate: z.string() }),
    outputSchema: z.object({ eventId: z.string(), rescheduledTo: z.string() }),
    approvalPolicy: "not_required",
    execute: async (input) => {
      const { eventId, newDate } = input as { eventId: string; newDate: string };
      return { eventId, rescheduledTo: newDate };
    },
    ...overrides,
  };
}

describe("AI tool registry", () => {
  afterEach(() => resetAIToolRegistry());

  it("registers and retrieves a tool by id", () => {
    registerAITool(makeTool());
    expect(getAITool("reschedule-event")?.description).toContain("Reschedules");
  });

  it("returns undefined for an id that was never registered", () => {
    expect(getAITool("does-not-exist")).toBeUndefined();
  });

  it("replaces an existing entry when registered again under the same id", () => {
    registerAITool(makeTool({ description: "v1" }));
    registerAITool(makeTool({ description: "v2" }));
    expect(listAITools()).toHaveLength(1);
    expect(getAITool("reschedule-event")?.description).toBe("v2");
  });
});

describe("executeAITool", () => {
  afterEach(() => resetAIToolRegistry());

  it("returns invalid_request for an unregistered tool", async () => {
    const result = await executeAITool("ghost", {}, baseContext());
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.category).toBe("invalid_request");
  });

  it("returns permission_denied when the acting user lacks the required permission", async () => {
    registerAITool(makeTool({ requiredPermission: "events.update" }));
    const result = await executeAITool("reschedule-event", { eventId: "e-1", newDate: "2026-08-01" }, baseContext({ permissions: [] }));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.category).toBe("permission_denied");
  });

  it("proceeds when the acting user holds the required permission", async () => {
    registerAITool(makeTool({ requiredPermission: "events.update" }));
    const result = await executeAITool(
      "reschedule-event",
      { eventId: "e-1", newDate: "2026-08-01" },
      baseContext({ permissions: ["events.update"] }),
    );
    expect(result.success).toBe(true);
  });

  it("returns approval_required when the tool demands approval and none was given", async () => {
    registerAITool(makeTool({ approvalPolicy: "always_required" }));
    const result = await executeAITool("reschedule-event", { eventId: "e-1", newDate: "2026-08-01" }, baseContext({ approved: false }));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.category).toBe("approval_required");
  });

  it("proceeds once approved for a tool that demands approval", async () => {
    registerAITool(makeTool({ approvalPolicy: "always_required" }));
    const result = await executeAITool("reschedule-event", { eventId: "e-1", newDate: "2026-08-01" }, baseContext({ approved: true }));
    expect(result.success).toBe(true);
  });

  it("checks permission before approval, and approval before input validation", async () => {
    registerAITool(makeTool({ requiredPermission: "events.update", approvalPolicy: "always_required" }));

    const permissionResult = await executeAITool("reschedule-event", "not-an-object", baseContext({ permissions: [], approved: false }));
    if (!permissionResult.success) expect(permissionResult.error.category).toBe("permission_denied");

    const approvalResult = await executeAITool(
      "reschedule-event",
      "not-an-object",
      baseContext({ permissions: ["events.update"], approved: false }),
    );
    if (!approvalResult.success) expect(approvalResult.error.category).toBe("approval_required");
  });

  it("returns schema_failure for input that doesn't match the tool's input schema", async () => {
    registerAITool(makeTool());
    const result = await executeAITool("reschedule-event", { eventId: 123 }, baseContext());
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.category).toBe("schema_failure");
  });

  it("returns provider_failure when execute throws, without leaking the caught message", async () => {
    registerAITool(makeTool({ execute: vi.fn().mockRejectedValue(new Error("db password is hunter2")) }));
    const result = await executeAITool("reschedule-event", { eventId: "e-1", newDate: "2026-08-01" }, baseContext());
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.category).toBe("provider_failure");
      expect(result.error.message).not.toContain("hunter2");
    }
  });

  it("returns schema_failure when the tool's own output doesn't match its output schema", async () => {
    registerAITool(makeTool({ execute: async () => ({ wrong: "shape" }) }));
    const result = await executeAITool("reschedule-event", { eventId: "e-1", newDate: "2026-08-01" }, baseContext());
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.category).toBe("schema_failure");
  });

  it("returns the parsed, validated output on success", async () => {
    registerAITool(makeTool());
    const result = await executeAITool("reschedule-event", { eventId: "e-1", newDate: "2026-08-01" }, baseContext());
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ eventId: "e-1", rescheduledTo: "2026-08-01" });
  });
});
