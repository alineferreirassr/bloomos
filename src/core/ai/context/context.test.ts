import { afterEach, describe, expect, it } from "vitest";
import { registerAIContextBuilder, getAIContextBuilder, listAIContextBuilders, resetAIContextRegistry } from "@/core/ai/context/registry";
import { assembleAIContext } from "@/core/ai/context/orchestrator";
import { workspaceContextBuilder } from "@/core/ai/context/builders/workspaceContextBuilder";
import { userContextBuilder } from "@/core/ai/context/builders/userContextBuilder";
import type { AIContextBuilder } from "@/core/ai/context/types";

describe("AI context builder registry", () => {
  afterEach(() => resetAIContextRegistry());

  it("registers and retrieves a builder by key", () => {
    registerAIContextBuilder(workspaceContextBuilder);
    expect(getAIContextBuilder("workspace")).toBe(workspaceContextBuilder);
  });

  it("returns undefined for a key with no registered builder", () => {
    expect(getAIContextBuilder("finance")).toBeUndefined();
  });

  it("lists every registered builder", () => {
    registerAIContextBuilder(workspaceContextBuilder);
    registerAIContextBuilder(userContextBuilder);
    expect(listAIContextBuilders().map((builder) => builder.key).sort()).toEqual(["user", "workspace"]);
  });
});

describe("workspaceContextBuilder", () => {
  it("formats the caller-provided workspace id and name", async () => {
    const result = await workspaceContextBuilder.build({ workspaceId: "ws-1", refs: { workspaceName: "Acme Events" } });
    expect(result).toEqual({ data: { id: "ws-1", name: "Acme Events" }, source: "caller-provided session workspace" });
  });

  it("defaults name to null when not supplied", async () => {
    const result = await workspaceContextBuilder.build({ workspaceId: "ws-1", refs: {} });
    expect(result?.data).toEqual({ id: "ws-1", name: null });
  });
});

describe("userContextBuilder", () => {
  it("formats the caller-provided actor", async () => {
    const result = await userContextBuilder.build({ workspaceId: "ws-1", refs: { userId: "u-1", userName: "Jordan" } });
    expect(result?.data).toEqual({ id: "u-1", name: "Jordan" });
  });

  it("returns null when no userId is supplied", async () => {
    const result = await userContextBuilder.build({ workspaceId: "ws-1", refs: {} });
    expect(result).toBeNull();
  });
});

describe("assembleAIContext", () => {
  afterEach(() => resetAIContextRegistry());

  it("assembles requested sections in canonical order regardless of request order", async () => {
    registerAIContextBuilder(userContextBuilder);
    registerAIContextBuilder(workspaceContextBuilder);

    const result = await assembleAIContext({
      workspaceId: "ws-1",
      sections: ["user", "workspace"],
      refs: { userId: "u-1", workspaceName: "Acme" },
    });

    expect(Object.keys(result.sections)).toEqual(["workspace", "user"]);
    expect(result.provenance.workspace).toBe("caller-provided session workspace");
    expect(result.provenance.user).toBe("caller-provided session actor");
    expect(result.truncated).toBe(false);
    expect(result.omittedSections).toEqual([]);
  });

  it("silently omits a section with no registered builder", async () => {
    const result = await assembleAIContext({ workspaceId: "ws-1", sections: ["finance"], refs: {} });
    expect(result.sections).toEqual({});
    expect(result.provenance).toEqual({});
  });

  it("omits a section whose builder returns null (e.g. a missing ref) without partial data", async () => {
    registerAIContextBuilder(userContextBuilder);
    const result = await assembleAIContext({ workspaceId: "ws-1", sections: ["user"], refs: {} });
    expect(result.sections).toEqual({});
  });

  it("never includes a section that wasn't requested even if a builder is registered for it", async () => {
    registerAIContextBuilder(userContextBuilder);
    registerAIContextBuilder(workspaceContextBuilder);
    const result = await assembleAIContext({ workspaceId: "ws-1", sections: ["user"], refs: { userId: "u-1" } });
    expect(Object.keys(result.sections)).toEqual(["user"]);
  });

  it("truncates lower-priority sections first when a token budget is supplied", async () => {
    const bigSection: AIContextBuilder = {
      key: "finance",
      priority: 5,
      build: async () => ({ data: { blob: "x".repeat(4000) }, source: "test-fixture" }),
    };
    registerAIContextBuilder(workspaceContextBuilder); // priority 0
    registerAIContextBuilder(bigSection);

    const result = await assembleAIContext({
      workspaceId: "ws-1",
      sections: ["workspace", "finance"],
      refs: { workspaceName: "Acme" },
      tokenBudget: { maxInputTokens: 100, reservedOutputTokens: 0 },
    });

    expect(result.truncated).toBe(true);
    expect(result.omittedSections).toEqual(["finance"]);
    expect(result.sections).toHaveProperty("workspace");
    expect(result.sections).not.toHaveProperty("finance");
    expect(result.provenance).not.toHaveProperty("finance");
  });

  it("estimates tokens even when no budget is supplied", async () => {
    registerAIContextBuilder(workspaceContextBuilder);
    const result = await assembleAIContext({ workspaceId: "ws-1", sections: ["workspace"], refs: { workspaceName: "Acme" } });
    expect(result.estimatedTokens).toBeGreaterThan(0);
  });
});
