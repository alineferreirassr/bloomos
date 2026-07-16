import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));
vi.mock("@/lib/auth/workspaceSessionClient", () => ({
  getClientWorkspaceSession: vi.fn(),
}));

import { supabaseConversionRepository } from "@/lib/data/conversion/supabaseConversionRepository";
import { createClient } from "@/lib/supabase/client";
import { getClientWorkspaceSession } from "@/lib/auth/workspaceSessionClient";

const SESSION = {
  status: "ok" as const,
  session: {
    user: { id: "user_1", email: "owner@example.com" },
    profile: {
      id: "user_1",
      full_name: "Amoré Bloom Owner",
      email: "owner@example.com",
      avatar_url: null,
      created_at: "2026-07-16T00:00:00Z",
      updated_at: "2026-07-16T00:00:00Z",
    },
    workspace: {
      id: "workspace_1",
      name: "Amoré Bloom",
      slug: "amore-bloom",
      created_by: "user_1",
      created_at: "2026-07-16T00:00:00Z",
      updated_at: "2026-07-16T00:00:00Z",
      archived_at: null,
    },
    membership: {
      id: "member_1",
      workspace_id: "workspace_1",
      user_id: "user_1",
      role: "owner" as const,
      status: "active" as const,
      created_at: "2026-07-16T00:00:00Z",
      updated_at: "2026-07-16T00:00:00Z",
    },
  },
};

function leadRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "lead_1",
    workspace_id: "workspace_1",
    first_name: "Sofia",
    last_name: "Marchetti",
    email: "sofia@example.com",
    phone: null,
    instagram: null,
    source: "Instagram",
    event_type: "Proposal",
    event_date: null,
    location: null,
    budget_min: null,
    budget_max: null,
    message: null,
    status: "converted",
    assigned_to: null,
    converted_client_id: "client_1",
    created_at: "2026-07-16T00:00:00Z",
    updated_at: "2026-07-17T00:00:00Z",
    archived_at: null,
    ...overrides,
  };
}

function clientRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "client_1",
    workspace_id: "workspace_1",
    originating_lead_id: "lead_1",
    first_name: "Sofia",
    last_name: "Marchetti",
    email: "sofia@example.com",
    phone: null,
    instagram: null,
    preferred_contact_method: null,
    partner_name: null,
    relationship_status: null,
    important_dates: [],
    address: null,
    city: null,
    state: null,
    zip_code: null,
    source: "Instagram",
    tags: [],
    internal_status: "active",
    is_returning: false,
    how_they_met: null,
    first_date: null,
    relationship_anniversary: null,
    engagement_date: null,
    wedding_date: null,
    favorite_colors: null,
    favorite_flowers: null,
    favorite_music: null,
    favorite_food: null,
    favorite_drinks: null,
    preferred_style: null,
    disliked_elements: null,
    allergies: null,
    accessibility_needs: null,
    dietary_restrictions: null,
    preferred_communication_time: null,
    do_not_call: false,
    surprise_event_confidentiality: false,
    emergency_contact_name: null,
    emergency_contact_phone: null,
    is_vip: false,
    created_at: "2026-07-17T00:00:00Z",
    updated_at: "2026-07-17T00:00:00Z",
    archived_at: null,
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

function mockSession() {
  vi.mocked(getClientWorkspaceSession).mockResolvedValue(SESSION as never);
}

function mockRpc(result: { data: unknown; error: unknown }) {
  const rpc = vi.fn().mockResolvedValue(result);
  vi.mocked(createClient).mockReturnValue({ rpc } as never);
  return rpc;
}

describe("supabaseConversionRepository.convertLeadToClient", () => {
  it("throws Unauthorized when there is no signed-in user", async () => {
    vi.mocked(getClientWorkspaceSession).mockResolvedValue({ status: "unauthenticated" });
    mockRpc({ data: null, error: null });

    await expect(supabaseConversionRepository.convertLeadToClient("lead_1")).rejects.toThrow(
      "Authentication is required.",
    );
  });

  it("throws Forbidden when the user has no active Workspace membership", async () => {
    vi.mocked(getClientWorkspaceSession).mockResolvedValue({ status: "no-workspace" });
    mockRpc({ data: null, error: null });

    await expect(supabaseConversionRepository.convertLeadToClient("lead_1")).rejects.toThrow(
      "You don't have permission to do that.",
    );
  });

  it("calls the convert_lead_to_client RPC with the lead id and resolved actor name, returning the mapped lead and client", async () => {
    mockSession();
    const rpc = mockRpc({ data: { lead: leadRow(), client: clientRow() }, error: null });

    const result = await supabaseConversionRepository.convertLeadToClient("lead_1");

    expect(rpc).toHaveBeenCalledWith("convert_lead_to_client", {
      p_lead_id: "lead_1",
      p_actor: "Amoré Bloom Owner",
    });
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.data.lead.status).toBe("converted");
    expect(result.data.lead.converted_client_id).toBe("client_1");
    expect(result.data.client.originating_lead_id).toBe("lead_1");
    expect(result.data.client.first_name).toBe("Sofia");
  });

  it("surfaces a P0001 business-rule rejection (e.g. already converted) as a DataResult failure, not a thrown error", async () => {
    mockSession();
    mockRpc({ data: null, error: { code: "P0001", message: "This lead has already been converted to a Client." } });

    const result = await supabaseConversionRepository.convertLeadToClient("lead_1");

    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(result.error).toBe("This lead has already been converted to a Client.");
  });

  it("surfaces the archived-lead P0001 rejection as a DataResult failure", async () => {
    mockSession();
    mockRpc({ data: null, error: { code: "P0001", message: "Archived leads cannot be converted to a Client." } });

    const result = await supabaseConversionRepository.convertLeadToClient("lead_1");

    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(result.error).toBe("Archived leads cannot be converted to a Client.");
  });

  it("surfaces the not-found P0001 rejection (also covers a cross-Workspace lead id hidden by RLS) as a DataResult failure", async () => {
    mockSession();
    mockRpc({ data: null, error: { code: "P0001", message: "Lead not found." } });

    const result = await supabaseConversionRepository.convertLeadToClient("lead_in_other_workspace");

    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(result.error).toBe("Lead not found.");
  });

  it("throws a normalized error for a non-business-rule failure (e.g. network/RLS)", async () => {
    mockSession();
    mockRpc({ data: null, error: { code: "42501", message: "permission denied" } });

    await expect(supabaseConversionRepository.convertLeadToClient("lead_1")).rejects.toThrow(
      "You don't have permission to do that.",
    );
  });
});
