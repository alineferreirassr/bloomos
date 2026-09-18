import { describe, expect, it } from "vitest";
import { mapLeadRow, mapProfileRow, mapWorkspaceMemberRow, mapWorkspaceRow } from "@/lib/supabase/mappers";

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

describe("mapLeadRow", () => {
  it("maps a leads row including the SOCIAL-15B attribution foundation columns", () => {
    const row = {
      id: "lead_1",
      workspace_id: "ws_1",
      first_name: "Jordan",
      last_name: "Ellis",
      email: "jordan@example.com",
      phone: null,
      instagram: "@jordan",
      instagram_external_id: "ig_ext_1",
      source: "Instagram",
      event_type: "wedding",
      event_date: null,
      location: null,
      budget_min: null,
      budget_max: null,
      message: "Interested!",
      status: "new",
      assigned_to: null,
      converted_client_id: null,
      social_post_id: "post_1",
      instagram_comment_id: "comment_1",
      instagram_conversation_id: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-02T00:00:00.000Z",
      archived_at: null,
    };
    expect(mapLeadRow(row)).toEqual(row);
  });

  it("maps a historical Lead's attribution columns as null — no backfill, ever", () => {
    const row = {
      id: "lead_2",
      workspace_id: "ws_1",
      first_name: "Alex",
      last_name: "Rivera",
      email: "alex@example.com",
      phone: null,
      instagram: null,
      instagram_external_id: null,
      source: "Referral",
      event_type: null,
      event_date: null,
      location: null,
      budget_min: null,
      budget_max: null,
      message: null,
      status: "new",
      assigned_to: null,
      converted_client_id: null,
      social_post_id: null,
      instagram_comment_id: null,
      instagram_conversation_id: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-02T00:00:00.000Z",
      archived_at: null,
    };
    const lead = mapLeadRow(row);
    expect(lead.social_post_id).toBeNull();
    expect(lead.instagram_comment_id).toBeNull();
    expect(lead.instagram_conversation_id).toBeNull();
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
