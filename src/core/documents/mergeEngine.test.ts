import { beforeEach, describe, expect, it } from "vitest";
import { registerMergeField, resetMergeFieldRegistry } from "@/core/documents/mergeFieldRegistry";
import { registerMergeResolver, resetMergeResolvers, resolveMergeFields } from "@/core/documents/mergeEngine";
import type { MergeContext } from "@/types/documentPlatform";

const baseContext: MergeContext = { workspaceId: "ws_1", memberId: "member_1" };

describe("resolveMergeFields", () => {
  beforeEach(() => {
    resetMergeFieldRegistry();
    resetMergeResolvers();
  });

  it("resolves a registered field through its own registered resolver", async () => {
    registerMergeField({ key: "greeting", label: "Greeting", description: "", domain: "workspace", valueType: "string", required: false });
    registerMergeResolver("greeting", async () => "hello");
    const scope = await resolveMergeFields(baseContext);
    expect(scope.greeting).toBe("hello");
  });

  it("resolves a field with no registered resolver to null rather than throwing", async () => {
    registerMergeField({ key: "orphan", label: "Orphan", description: "", domain: "workspace", valueType: "string", required: false });
    const scope = await resolveMergeFields(baseContext);
    expect(scope.orphan).toBeNull();
  });

  it("resolves every registered field, keyed by its own key", async () => {
    registerMergeField({ key: "a", label: "A", description: "", domain: "workspace", valueType: "string", required: false });
    registerMergeField({ key: "b", label: "B", description: "", domain: "crm", valueType: "number", required: false });
    registerMergeResolver("a", async () => "value-a");
    registerMergeResolver("b", async () => 42);
    const scope = await resolveMergeFields(baseContext);
    expect(scope).toEqual({ a: "value-a", b: 42 });
  });

  it("passes the given context through to each resolver", async () => {
    registerMergeField({ key: "workspace_echo", label: "Echo", description: "", domain: "workspace", valueType: "string", required: false });
    registerMergeResolver("workspace_echo", async (context) => context.workspaceId);
    const scope = await resolveMergeFields({ workspaceId: "ws_42", memberId: "member_1" });
    expect(scope.workspace_echo).toBe("ws_42");
  });

  it("resolves fields in parallel — a slow resolver doesn't block others from appearing", async () => {
    registerMergeField({ key: "slow", label: "Slow", description: "", domain: "workspace", valueType: "string", required: false });
    registerMergeField({ key: "fast", label: "Fast", description: "", domain: "workspace", valueType: "string", required: false });
    registerMergeResolver("slow", async () => new Promise((resolve) => setTimeout(() => resolve("slow-value"), 10)));
    registerMergeResolver("fast", async () => "fast-value");
    const scope = await resolveMergeFields(baseContext);
    expect(scope).toEqual({ slow: "slow-value", fast: "fast-value" });
  });
});
