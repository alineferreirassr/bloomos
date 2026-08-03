import { describe, it, expect, beforeEach } from "vitest";
import { mockJourneyOwnersRepository, resetJourneyOwnersStore } from "./journeyOwnersStore";

beforeEach(() => {
  resetJourneyOwnersStore();
});

describe("mockJourneyOwnersRepository", () => {
  it("fails to assign without a memberId", async () => {
    const result = await mockJourneyOwnersRepository.assignOwner("workspace_1", "client", "client_1", "primary", "", "member_1");
    expect(result.success).toBe(false);
  });

  it("assigns a new owner for a role", async () => {
    const result = await mockJourneyOwnersRepository.assignOwner("workspace_1", "client", "client_1", "primary", "member_1", "member_admin");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.memberId).toBe("member_1");
      expect(result.data.assignedByMemberId).toBe("member_admin");
    }
  });

  it("replaces the previous assignment for the same role rather than duplicating it", async () => {
    await mockJourneyOwnersRepository.assignOwner("workspace_1", "client", "client_1", "primary", "member_1", null);
    await mockJourneyOwnersRepository.assignOwner("workspace_1", "client", "client_1", "primary", "member_2", null);
    const owners = await mockJourneyOwnersRepository.listOwnersFor("workspace_1", "client", "client_1");
    expect(owners).toHaveLength(1);
    expect(owners[0].memberId).toBe("member_2");
  });

  it("supports multiple distinct roles for the same subject", async () => {
    await mockJourneyOwnersRepository.assignOwner("workspace_1", "client", "client_1", "primary", "member_1", null);
    await mockJourneyOwnersRepository.assignOwner("workspace_1", "client", "client_1", "finance", "member_2", null);
    const owners = await mockJourneyOwnersRepository.listOwnersFor("workspace_1", "client", "client_1");
    expect(owners).toHaveLength(2);
  });

  it("unassignOwner removes only the targeted role", async () => {
    await mockJourneyOwnersRepository.assignOwner("workspace_1", "client", "client_1", "primary", "member_1", null);
    await mockJourneyOwnersRepository.assignOwner("workspace_1", "client", "client_1", "finance", "member_2", null);
    await mockJourneyOwnersRepository.unassignOwner("workspace_1", "client", "client_1", "primary");
    const owners = await mockJourneyOwnersRepository.listOwnersFor("workspace_1", "client", "client_1");
    expect(owners).toHaveLength(1);
    expect(owners[0].role).toBe("finance");
  });
});
