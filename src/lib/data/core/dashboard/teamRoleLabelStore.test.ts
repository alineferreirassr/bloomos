import { afterEach, describe, expect, it } from "vitest";
import { getTeamRoleLabel, resetTeamRoleLabelStore, setTeamRoleLabel } from "@/lib/data/core/dashboard/teamRoleLabelStore";

afterEach(() => {
  resetTeamRoleLabelStore();
});

describe("teamRoleLabelStore", () => {
  it("defaults to general_staff for a member with no label set", () => {
    expect(getTeamRoleLabel("member_1")).toBe("general_staff");
  });

  it("returns the set label for that member only", () => {
    setTeamRoleLabel("member_1", "photographer");
    expect(getTeamRoleLabel("member_1")).toBe("photographer");
    expect(getTeamRoleLabel("member_2")).toBe("general_staff");
  });

  it("overwrites a previously set label", () => {
    setTeamRoleLabel("member_1", "planner");
    setTeamRoleLabel("member_1", "designer");
    expect(getTeamRoleLabel("member_1")).toBe("designer");
  });

  it("reset clears every label back to the default", () => {
    setTeamRoleLabel("member_1", "finance");
    resetTeamRoleLabelStore();
    expect(getTeamRoleLabel("member_1")).toBe("general_staff");
  });
});
