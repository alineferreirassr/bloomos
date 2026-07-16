import { describe, expect, it } from "vitest";
import { getWorkspaceDisplayName } from "@/lib/workspaceDisplayName";

describe("getWorkspaceDisplayName", () => {
  it("shows the bare Workspace name for owner", () => {
    expect(getWorkspaceDisplayName("owner", "Amoré Bloom")).toBe("Amoré Bloom");
  });

  it("shows the bare Workspace name for admin", () => {
    expect(getWorkspaceDisplayName("admin", "Amoré Bloom")).toBe("Amoré Bloom");
  });

  it("appends Team for manager", () => {
    expect(getWorkspaceDisplayName("manager", "Amoré Bloom")).toBe("Amoré Bloom Team");
  });

  it("appends Team for team", () => {
    expect(getWorkspaceDisplayName("team", "Amoré Bloom")).toBe("Amoré Bloom Team");
  });

  it("appends Team for viewer", () => {
    expect(getWorkspaceDisplayName("viewer", "Amoré Bloom")).toBe("Amoré Bloom Team");
  });

  it("appends Team when role is null (mock mode / no resolved session), reproducing the prior static label", () => {
    expect(getWorkspaceDisplayName(null, "Amoré Bloom")).toBe("Amoré Bloom Team");
  });
});
