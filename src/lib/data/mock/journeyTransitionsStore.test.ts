import { describe, it, expect, beforeEach } from "vitest";
import { mockJourneyTransitionsRepository, resetJourneyTransitionsStore } from "./journeyTransitionsStore";

beforeEach(() => {
  resetJourneyTransitionsStore();
});

describe("mockJourneyTransitionsRepository", () => {
  it("records a transition and returns it with a generated id and timestamp", async () => {
    const record = await mockJourneyTransitionsRepository.recordTransition({
      workspaceId: "workspace_1",
      subjectType: "client",
      subjectId: "client_1",
      type: "allowed",
      previousStage: "qualified",
      newStage: "proposal_preparation",
      trigger: "manual",
    });
    expect(record.id).toBeTruthy();
    expect(record.createdAt).toBeTruthy();
    expect(record.blockingRules).toEqual([]);
  });

  it("lists transitions for a subject in chronological order", async () => {
    await mockJourneyTransitionsRepository.recordTransition({ workspaceId: "workspace_1", subjectType: "client", subjectId: "client_1", type: "allowed", previousStage: null, newStage: "qualified", trigger: "a" });
    await mockJourneyTransitionsRepository.recordTransition({ workspaceId: "workspace_1", subjectType: "client", subjectId: "client_1", type: "allowed", previousStage: "qualified", newStage: "proposal_preparation", trigger: "b" });
    const list = await mockJourneyTransitionsRepository.listTransitionsFor("workspace_1", "client", "client_1");
    expect(list.map((t) => t.trigger)).toEqual(["a", "b"]);
  });

  it("scopes transitions strictly by workspace, subjectType, and subjectId", async () => {
    await mockJourneyTransitionsRepository.recordTransition({ workspaceId: "workspace_1", subjectType: "client", subjectId: "client_1", type: "allowed", previousStage: null, newStage: "qualified", trigger: "a" });
    await mockJourneyTransitionsRepository.recordTransition({ workspaceId: "workspace_1", subjectType: "lead", subjectId: "client_1", type: "allowed", previousStage: null, newStage: "contacted", trigger: "b" });
    const list = await mockJourneyTransitionsRepository.listTransitionsFor("workspace_1", "client", "client_1");
    expect(list).toHaveLength(1);
  });

  it("getLatestTransition returns null when none exist, and the most recent one otherwise", async () => {
    expect(await mockJourneyTransitionsRepository.getLatestTransition("workspace_1", "client", "client_1")).toBeNull();
    await mockJourneyTransitionsRepository.recordTransition({ workspaceId: "workspace_1", subjectType: "client", subjectId: "client_1", type: "allowed", previousStage: null, newStage: "qualified", trigger: "a" });
    await mockJourneyTransitionsRepository.recordTransition({ workspaceId: "workspace_1", subjectType: "client", subjectId: "client_1", type: "reopened", previousStage: "qualified", newStage: "contacted", trigger: "b" });
    const latest = await mockJourneyTransitionsRepository.getLatestTransition("workspace_1", "client", "client_1");
    expect(latest?.trigger).toBe("b");
  });
});
