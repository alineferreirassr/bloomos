import { describe, expect, it } from "vitest";
import { resolveDashboardExperience } from "@/core/dashboard/resolveDashboardExperience";

describe("resolveDashboardExperience", () => {
  it("resolves owner to the owner experience", () => {
    expect(resolveDashboardExperience("owner")).toBe("owner");
  });

  it("resolves admin to the owner experience", () => {
    expect(resolveDashboardExperience("admin")).toBe("owner");
  });

  it("resolves manager to the team experience", () => {
    expect(resolveDashboardExperience("manager")).toBe("team");
  });

  it("resolves staff to the team experience", () => {
    expect(resolveDashboardExperience("staff")).toBe("team");
  });
});
