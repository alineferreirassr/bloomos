import { describe, expect, it } from "vitest";
import { toApiClient, toApiEvent, toApiPortalUser } from "@/core/api/mappers";
import { makeClient } from "@/modules/clients/testUtils";
import { makeEvent } from "@/modules/events/testUtils";
import type { ClientAccount } from "@/types/clientAccount";

const INTERNAL_ONLY_CLIENT_FIELDS = [
  "allergies",
  "accessibility_needs",
  "dietary_restrictions",
  "preferred_communication_time",
  "do_not_call",
  "surprise_event_confidentiality",
  "emergency_contact_name",
  "emergency_contact_phone",
];

describe("toApiClient", () => {
  it("excludes every internal-only field types/client.ts marks off-limits", () => {
    const client = makeClient({ allergies: "peanuts", do_not_call: true, emergency_contact_name: "Jane Doe" });
    const api = toApiClient(client);
    for (const field of INTERNAL_ONLY_CLIENT_FIELDS) {
      expect(api).not.toHaveProperty(field);
    }
  });

  it("maps internal_status to a public status field, and preserves every other operational field", () => {
    const client = makeClient({ first_name: "Naomi", internal_status: "active", is_vip: true });
    const api = toApiClient(client);
    expect(api.status).toBe("active");
    expect(api.first_name).toBe("Naomi");
    expect(api.is_vip).toBe(true);
    expect(api).not.toHaveProperty("internal_status");
  });
});

describe("toApiEvent", () => {
  it("excludes internal_summary, confidentiality_notes, and surprise_event", () => {
    const event = makeEvent({ internal_summary: "VIP handling notes", confidentiality_notes: "Keep quiet", surprise_event: true });
    const api = toApiEvent(event);
    expect(api).not.toHaveProperty("internal_summary");
    expect(api).not.toHaveProperty("confidentiality_notes");
    expect(api).not.toHaveProperty("surprise_event");
  });

  it("preserves every operational field a logistics integration would need", () => {
    const event = makeEvent({ title: "Wedding Reception", guest_count: 120, event_date: "2026-06-01" });
    const api = toApiEvent(event);
    expect(api.title).toBe("Wedding Reception");
    expect(api.guest_count).toBe(120);
    expect(api.event_date).toBe("2026-06-01");
  });
});

describe("toApiPortalUser", () => {
  const account: ClientAccount = {
    id: "account_1",
    workspace_id: "ws_1",
    client_id: "client_1",
    auth_user_id: "auth_user_secret_id",
    email: "client@example.com",
    status: "active",
    invited_by: "member_1",
    accepted_at: "2026-01-01T00:00:00.000Z",
    suspended_at: null,
    revoked_at: null,
    last_access_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };

  it("excludes auth_user_id — a raw Supabase Auth identifier a third party never needs", () => {
    const api = toApiPortalUser(account);
    expect(api).not.toHaveProperty("auth_user_id");
  });

  it("preserves the account's own identity and lifecycle fields", () => {
    const api = toApiPortalUser(account);
    expect(api).toEqual({
      id: "account_1",
      client_id: "client_1",
      email: "client@example.com",
      status: "active",
      invited_by: "member_1",
      accepted_at: "2026-01-01T00:00:00.000Z",
      suspended_at: null,
      revoked_at: null,
      last_access_at: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });
  });
});
