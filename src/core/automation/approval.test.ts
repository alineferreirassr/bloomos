import { afterEach, describe, expect, it } from "vitest";
import { resolveApprovalRequirement, canGrantApproval } from "@/core/automation/approval";
import { getAutomationManager } from "@/core/automation/manager";
import { resetAutomationStore } from "@/lib/data/core/automation/mockRepository";

afterEach(() => resetAutomationStore());

describe("resolveApprovalRequirement", () => {
  it("always_required is always true", async () => {
    const result = await resolveApprovalRequirement({ workspaceId: "ws_1", automationId: "a", policy: { kind: "always_required" } });
    expect(result).toBe(true);
  });

  it("role_restricted is always true — approval is required, restricting who may grant it is a separate question", async () => {
    const result = await resolveApprovalRequirement({ workspaceId: "ws_1", automationId: "a", policy: { kind: "role_restricted", minimumApproverRole: "manager" } });
    expect(result).toBe(true);
  });

  it("never_required is always false", async () => {
    const result = await resolveApprovalRequirement({ workspaceId: "ws_1", automationId: "a", policy: { kind: "never_required" } });
    expect(result).toBe(false);
  });

  describe("workspace_configurable", () => {
    it("defaults to required (true) when no override has ever been set — the safer default", async () => {
      const result = await resolveApprovalRequirement({ workspaceId: "ws_1", automationId: "unset-automation", policy: { kind: "workspace_configurable" } });
      expect(result).toBe(true);
    });

    it("honors an explicit override that relaxes the requirement", async () => {
      await getAutomationManager().setApprovalOverride("ws_1", "relaxed-automation", false);
      const result = await resolveApprovalRequirement({ workspaceId: "ws_1", automationId: "relaxed-automation", policy: { kind: "workspace_configurable" } });
      expect(result).toBe(false);
    });

    it("honors an explicit override that re-tightens the requirement", async () => {
      await getAutomationManager().setApprovalOverride("ws_1", "tight-automation", false);
      await getAutomationManager().setApprovalOverride("ws_1", "tight-automation", true);
      const result = await resolveApprovalRequirement({ workspaceId: "ws_1", automationId: "tight-automation", policy: { kind: "workspace_configurable" } });
      expect(result).toBe(true);
    });

    it("an override is scoped per Workspace — one Workspace's override never leaks into another's", async () => {
      await getAutomationManager().setApprovalOverride("ws_1", "shared-automation", false);
      const otherWorkspace = await resolveApprovalRequirement({ workspaceId: "ws_2", automationId: "shared-automation", policy: { kind: "workspace_configurable" } });
      expect(otherWorkspace).toBe(true);
    });
  });
});

describe("canGrantApproval", () => {
  it("every non-role_restricted policy accepts any approver, including no role at all", () => {
    expect(canGrantApproval({ policy: { kind: "always_required" }, approverRole: null })).toBe(true);
    expect(canGrantApproval({ policy: { kind: "never_required" }, approverRole: "staff" })).toBe(true);
    expect(canGrantApproval({ policy: { kind: "workspace_configurable" }, approverRole: null })).toBe(true);
  });

  it("role_restricted with no minimumApproverRole set accepts any approver", () => {
    expect(canGrantApproval({ policy: { kind: "role_restricted" }, approverRole: "staff" })).toBe(true);
  });

  it("role_restricted rejects an approver with no role at all", () => {
    expect(canGrantApproval({ policy: { kind: "role_restricted", minimumApproverRole: "manager" }, approverRole: null })).toBe(false);
  });

  it("role_restricted accepts an approver at or above the minimum role", () => {
    const policy = { kind: "role_restricted" as const, minimumApproverRole: "manager" as const };
    expect(canGrantApproval({ policy, approverRole: "owner" })).toBe(true);
    expect(canGrantApproval({ policy, approverRole: "admin" })).toBe(true);
    expect(canGrantApproval({ policy, approverRole: "manager" })).toBe(true);
  });

  it("role_restricted rejects an approver below the minimum role", () => {
    const policy = { kind: "role_restricted" as const, minimumApproverRole: "manager" as const };
    expect(canGrantApproval({ policy, approverRole: "staff" })).toBe(false);
  });
});
