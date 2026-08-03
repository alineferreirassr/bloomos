import { afterEach, describe, expect, it } from "vitest";
import { memoryContextBuilder } from "@/core/ai/context/builders/memoryContextBuilder";
import { getMemoryManager } from "@/core/ai/memory";
import { resetAIMemoryStore } from "@/lib/data/core/aiMemory/mockRepository";

afterEach(() => resetAIMemoryStore());

describe("memoryContextBuilder", () => {
  it("returns null when this Workspace has no matching memory yet — optional, never a hard failure", async () => {
    const result = await memoryContextBuilder.build({ workspaceId: "ws_1", refs: {} });
    expect(result).toBeNull();
  });

  it("returns only approved memories scoped by memorySkillId and memoryCategory refs", async () => {
    const manager = getMemoryManager();
    await manager.createMemory("ws_1", {
      skillId: "daily-operations-brief",
      title: "Daily Brief snapshot",
      summary: "[]",
      category: "historical_knowledge",
      importance: "low",
      visibility: "workspace",
      confidence: 100,
      source: "system",
    });
    await manager.proposeMemory("ws_1", {
      skillId: "daily-operations-brief",
      title: "Not yet reviewed",
      summary: "[]",
      category: "historical_knowledge",
      visibility: "workspace",
    });
    await manager.createMemory("ws_1", {
      skillId: "proposal.generate",
      title: "A different Skill's own memory",
      summary: "Should not match memorySkillId scoping.",
      category: "operational_knowledge",
      importance: "medium",
      visibility: "workspace",
      confidence: 100,
      source: "human",
    });

    const result = await memoryContextBuilder.build({
      workspaceId: "ws_1",
      refs: { memorySkillId: "daily-operations-brief", memoryCategory: "historical_knowledge" },
    });

    expect(result).not.toBeNull();
    const data = result?.data as { memories: { title: string }[] };
    expect(data.memories).toHaveLength(1);
    expect(data.memories[0].title).toBe("Daily Brief snapshot");
  });

  it("scopes by entityId when eventId or clientId refs are supplied", async () => {
    const manager = getMemoryManager();
    await manager.createMemory("ws_1", {
      skillId: "proposal.generate",
      entityType: "event",
      entityId: "event_1",
      title: "Memory about event_1",
      summary: "Relevant to this Event only.",
      category: "operational_knowledge",
      importance: "medium",
      visibility: "workspace",
      confidence: 100,
      source: "human",
    });
    await manager.createMemory("ws_1", {
      skillId: "proposal.generate",
      entityType: "event",
      entityId: "event_2",
      title: "Memory about event_2",
      summary: "Should not match event_1's own lookup.",
      category: "operational_knowledge",
      importance: "medium",
      visibility: "workspace",
      confidence: 100,
      source: "human",
    });

    const result = await memoryContextBuilder.build({ workspaceId: "ws_1", refs: { eventId: "event_1" } });
    const data = result?.data as { memories: { title: string }[] };
    expect(data.memories).toHaveLength(1);
    expect(data.memories[0].title).toBe("Memory about event_1");
  });

  it("never returns another Workspace's own memory", async () => {
    await getMemoryManager().createMemory("ws_other", {
      skillId: "daily-operations-brief",
      title: "Another Workspace's snapshot",
      summary: "[]",
      category: "historical_knowledge",
      importance: "low",
      visibility: "workspace",
      confidence: 100,
      source: "system",
    });

    const result = await memoryContextBuilder.build({ workspaceId: "ws_1", refs: { memorySkillId: "daily-operations-brief" } });
    expect(result).toBeNull();
  });
});
