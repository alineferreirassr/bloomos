import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockTeamsRepository, resetTeamsStore, type CreateTeamInput } from "@/lib/data/mock/teamsStore";

const baseInput: CreateTeamInput = { name: "Install Crew", description: null, leader_worker_id: null };

beforeEach(() => resetTeamsStore());
afterEach(() => resetTeamsStore());

describe("mockTeamsRepository", () => {
  it("creates a team defaulting to active status", async () => {
    const result = await mockTeamsRepository.createTeam("ws_1", baseInput);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("active");
    expect(result.data.member_worker_ids).toEqual([]);
  });

  it("auto-includes the leader as the first member when provided", async () => {
    const result = await mockTeamsRepository.createTeam("ws_1", { ...baseInput, leader_worker_id: "worker_1" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.member_worker_ids).toEqual(["worker_1"]);
  });

  it("rejects a blank team name", async () => {
    const result = await mockTeamsRepository.createTeam("ws_1", { ...baseInput, name: "  " });
    expect(result.success).toBe(false);
  });

  it("addMemberToTeam is idempotent for an already-present member", async () => {
    const created = await mockTeamsRepository.createTeam("ws_1", baseInput);
    if (!created.success) return;
    await mockTeamsRepository.addMemberToTeam(created.data.id, "ws_1", "worker_1");
    const second = await mockTeamsRepository.addMemberToTeam(created.data.id, "ws_1", "worker_1");
    expect(second.success).toBe(true);
    if (second.success) expect(second.data.member_worker_ids).toEqual(["worker_1"]);
  });

  it("removeMemberFromTeam clears leader_worker_id when the leader is removed", async () => {
    const created = await mockTeamsRepository.createTeam("ws_1", { ...baseInput, leader_worker_id: "worker_1" });
    if (!created.success) return;
    const result = await mockTeamsRepository.removeMemberFromTeam(created.data.id, "ws_1", "worker_1");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.member_worker_ids).toEqual([]);
      expect(result.data.leader_worker_id).toBeNull();
    }
  });

  it("setTeamStatus('archived') sets archived_at", async () => {
    const created = await mockTeamsRepository.createTeam("ws_1", baseInput);
    if (!created.success) return;
    const archived = await mockTeamsRepository.setTeamStatus(created.data.id, "ws_1", "archived");
    expect(archived.success).toBe(true);
    if (archived.success) expect(archived.data.archived_at).not.toBeNull();
  });

  it("lists teams scoped to the workspace", async () => {
    await mockTeamsRepository.createTeam("ws_1", baseInput);
    await mockTeamsRepository.createTeam("ws_2", baseInput);
    expect(await mockTeamsRepository.listTeamsForWorkspace("ws_1")).toHaveLength(1);
  });
});
