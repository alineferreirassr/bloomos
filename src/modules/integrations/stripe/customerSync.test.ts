import { afterEach, describe, expect, it, vi } from "vitest";
import type { Client } from "@/types/client";

const { fakeClient, fakeProvider } = vi.hoisted(() => {
  const fakeClient: Client = {
    id: "client_1",
    workspace_id: "ws_1",
    originating_lead_id: null,
    first_name: "Jordan",
    last_name: "Blake",
    email: "jordan@example.test",
    phone: "555-0100",
    instagram: null,
    preferred_contact_method: null,
    partner_name: null,
    relationship_status: null,
    important_dates: [],
    address: "123 Main St",
    city: "Austin",
    state: "TX",
    zip_code: "78701",
    source: null,
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
    favorite_restaurants: null,
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
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    archived_at: null,
    pending_recovery: null,
  };
  const fakeProvider = {
    createCustomer: vi.fn().mockResolvedValue({ id: "cus_new" }),
    updateCustomer: vi.fn().mockResolvedValue({ id: "cus_existing" }),
  };
  return { fakeClient, fakeProvider };
});

vi.mock("@/lib/data", () => ({
  getClientById: vi.fn().mockResolvedValue(fakeClient),
}));

vi.mock("@/core/integrations/providers/stripe/stripeClient", () => ({
  getStripeProviderForWorkspace: vi.fn().mockResolvedValue(fakeProvider),
}));

import { getExistingStripeCustomerMapping, syncClientToStripeCustomer } from "@/modules/integrations/stripe/customerSync";
import { resetStripeCustomerMappingStore } from "@/lib/data/core/integrations/stripeCustomerMappingStore";

afterEach(() => {
  vi.clearAllMocks();
  resetStripeCustomerMappingStore();
});

describe("syncClientToStripeCustomer", () => {
  it("creates a new Stripe Customer with mapped fields on first sync", async () => {
    const result = await syncClientToStripeCustomer("ws_1", "client_1");
    expect(fakeProvider.createCustomer).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "jordan@example.test",
        name: "Jordan Blake",
        phone: "555-0100",
        address: { line1: "123 Main St", city: "Austin", state: "TX", postal_code: "78701" },
        metadata: { bloomos_client_id: "client_1", bloomos_workspace_id: "ws_1" },
      }),
    );
    expect(result.mapping.stripe_customer_id).toBe("cus_new");
    expect(result.mapping.client_id).toBe("client_1");
  });

  it("updates the existing Stripe Customer on a second sync — never creates a duplicate", async () => {
    await syncClientToStripeCustomer("ws_1", "client_1");
    fakeProvider.createCustomer.mockClear();

    const second = await syncClientToStripeCustomer("ws_1", "client_1");
    expect(fakeProvider.createCustomer).not.toHaveBeenCalled();
    expect(fakeProvider.updateCustomer).toHaveBeenCalledWith("cus_new", expect.objectContaining({ email: "jordan@example.test" }));
    expect(second.mapping.stripe_customer_id).toBe("cus_existing");
  });
});

describe("getExistingStripeCustomerMapping", () => {
  it("returns null before any sync, and the mapping after", async () => {
    expect(getExistingStripeCustomerMapping("client_1")).toBeNull();
    await syncClientToStripeCustomer("ws_1", "client_1");
    expect(getExistingStripeCustomerMapping("client_1")).not.toBeNull();
  });
});
