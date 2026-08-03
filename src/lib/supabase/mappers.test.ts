import { describe, expect, it } from "vitest";
import { mapProfileRow, mapWorkspaceMemberRow, mapWorkspaceRow } from "@/lib/supabase/mappers";

describe("mapProfileRow", () => {
  it("maps a profiles row to the Profile domain type", () => {
    const row = {
      id: "user_1",
      full_name: "Jordan Ellis",
      email: "jordan@example.com",
      avatar_url: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-02T00:00:00.000Z",
    };
    expect(mapProfileRow(row)).toEqual(row);
  });
});

describe("mapWorkspaceRow", () => {
  it("maps a workspaces row to the Workspace domain type", () => {
    const row = {
      id: "ws_1",
      name: "Amoré Bloom",
      slug: "amore-bloom",
      created_by: "user_1",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-02T00:00:00.000Z",
      archived_at: null,
    };
    expect(mapWorkspaceRow(row)).toEqual(row);
  });
});

describe("mapWorkspaceMemberRow", () => {
  it("maps a workspace_members row and narrows role/status to their enum types", () => {
    const row = {
      id: "wm_1",
      workspace_id: "ws_1",
      user_id: "user_1",
      role: "owner",
      status: "active",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-02T00:00:00.000Z",
    };
    expect(mapWorkspaceMemberRow(row)).toEqual(row);
  });
});
