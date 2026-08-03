import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/data/mock/clientsStore", () => ({
  readClients: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { clientContextBuilder } from "@/modules/ai/contextBuilders/clientContextBuilder";
import { readClients } from "@/lib/data/mock/clientsStore";
import type { Client } from "@/types/client";

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: "client_1",
    workspace_id: "ws_1",
    originating_lead_id: null,
    first_name: "Jamie",
    last_name: "Rivera",
    email: "jamie@example.com",
    phone: null,
    instagram: null,
    preferred_contact_method: null,
    partner_name: null,
    relationship_status: "Dating",
    important_dates: [{ id: "d1", label: "First date", date: "2024-01-01" }],
    address: null,
    city: null,
    state: null,
    zip_code: null,
    source: null,
    tags: [],
    internal_status: "active",
    is_returning: false,
    how_they_met: null,
    first_date: null,
    relationship_anniversary: null,
    engagement_date: null,
    wedding_date: null,
    favorite_colors: "Blue",
    favorite_flowers: null,
    favorite_music: null,
    favorite_food: null,
    favorite_drinks: null,
    favorite_restaurants: null,
    preferred_style: null,
    disliked_elements: null,
    allergies: "Peanuts — do not surface to AI context",
    accessibility_needs: "Wheelchair access — do not surface to AI context",
    dietary_restrictions: "Vegan — do not surface to AI context",
    preferred_communication_time: null,
    do_not_call: false,
    surprise_event_confidentiality: false,
    emergency_contact_name: "Should never appear",
    emergency_contact_phone: "555-0000",
    is_vip: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    archived_at: null,
    pending_recovery: null,
    ...overrides,
  };
}

afterEach(() => vi.clearAllMocks());

describe("clientContextBuilder", () => {
  it("returns null when no clientId ref is supplied", async () => {
    const result = await clientContextBuilder.build({ workspaceId: "ws_1", refs: {} });
    expect(result).toBeNull();
    expect(readClients).not.toHaveBeenCalled();
  });

  it("returns null when the Client doesn't exist", async () => {
    vi.mocked(readClients).mockReturnValue([]);
    const result = await clientContextBuilder.build({ workspaceId: "ws_1", refs: { clientId: "missing" } });
    expect(result).toBeNull();
  });

  it("formats a found Client's safe fields", async () => {
    vi.mocked(readClients).mockReturnValue([makeClient()]);
    const result = await clientContextBuilder.build({ workspaceId: "ws_1", refs: { clientId: "client_1" } });
    expect(result?.data).toEqual({
      name: "Jamie Rivera",
      relationshipStatus: "Dating",
      favoriteColors: "Blue",
      favoriteFlowers: null,
      favoriteMusic: null,
      favoriteFood: null,
      favoriteDrinks: null,
      favoriteRestaurants: null,
      preferredStyle: null,
      importantDates: [{ label: "First date", date: "2024-01-01" }],
    });
  });

  it("never includes any internal-only Client field in the returned context", async () => {
    vi.mocked(readClients).mockReturnValue([makeClient()]);
    const result = await clientContextBuilder.build({ workspaceId: "ws_1", refs: { clientId: "client_1" } });
    const serialized = JSON.stringify(result?.data);
    expect(serialized).not.toContain("Peanuts");
    expect(serialized).not.toContain("Wheelchair");
    expect(serialized).not.toContain("Vegan");
    expect(serialized).not.toContain("Should never appear");
    expect(serialized).not.toContain("555-0000");
    expect(serialized).not.toContain("is_vip");
  });
});
