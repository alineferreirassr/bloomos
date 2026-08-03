import { afterEach, describe, expect, it, vi } from "vitest";
import type { Service } from "@/types/service";
import type { ServiceVersion } from "@/types/serviceVersion";

const { fakeService, fakeVersion, fakeProvider } = vi.hoisted(() => {
  const fakeService: Service = {
    id: "svc_1",
    workspace_id: "ws_1",
    category_id: null,
    name: "Luxury Picnic",
    description: "A curated luxury picnic experience.",
    status: "active",
    draft_version_id: null,
    current_published_version_id: "sv_1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    archived_at: null,
  };
  const fakeVersion: ServiceVersion = {
    id: "sv_1",
    service_id: "svc_1",
    workspace_id: "ws_1",
    version_number: 1,
    status: "published",
    name_snapshot: "Luxury Picnic",
    description_snapshot: "A curated luxury picnic experience.",
    base_price_minor: 50000,
    currency: "usd",
    setup_duration_minutes: null,
    breakdown_duration_minutes: null,
    difficulty_score: null,
    experience_level_required: null,
    weather_sensitivity: "none",
    surprise_friendly: false,
    estimated_profit_minor: null,
    change_summary: null,
    published_at: "2026-01-01T00:00:00.000Z",
    published_by: "user_1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
  const fakeProvider = {
    createProduct: vi.fn().mockResolvedValue({ id: "prod_1" }),
    updateProduct: vi.fn().mockResolvedValue({ id: "prod_1" }),
    archiveProduct: vi.fn().mockResolvedValue({ id: "prod_1", active: false }),
    createPrice: vi.fn().mockResolvedValue({ id: "price_1" }),
    archivePrice: vi.fn().mockResolvedValue({ id: "price_1", active: false }),
  };
  return { fakeService, fakeVersion, fakeProvider };
});

vi.mock("@/lib/data", () => ({
  getService: vi.fn().mockImplementation(async () => fakeService),
  getServiceVersion: vi.fn().mockResolvedValue(fakeVersion),
}));

vi.mock("@/core/integrations/providers/stripe/stripeClient", () => ({
  getStripeProviderForWorkspace: vi.fn().mockResolvedValue(fakeProvider),
}));

import { getExistingStripeProductMapping, syncServiceToStripeProduct } from "@/modules/integrations/stripe/productSync";
import { getService } from "@/lib/data";
import { resetStripeProductMappingStore } from "@/lib/data/core/integrations/stripeProductMappingStore";

afterEach(() => {
  vi.clearAllMocks();
  resetStripeProductMappingStore();
  vi.mocked(getService).mockImplementation(async () => fakeService);
  fakeProvider.createProduct.mockResolvedValue({ id: "prod_1" });
  fakeProvider.updateProduct.mockResolvedValue({ id: "prod_1" });
  fakeProvider.archiveProduct.mockResolvedValue({ id: "prod_1", active: false });
  fakeProvider.createPrice.mockResolvedValue({ id: "price_1" });
  fakeProvider.archivePrice.mockResolvedValue({ id: "price_1", active: false });
});

describe("syncServiceToStripeProduct", () => {
  it("creates a new Product and Price on first sync of a published Service", async () => {
    const result = await syncServiceToStripeProduct("ws_1", "svc_1");
    expect(fakeProvider.createProduct).toHaveBeenCalledWith(expect.objectContaining({ name: "Luxury Picnic" }));
    expect(fakeProvider.createPrice).toHaveBeenCalledWith(expect.objectContaining({ productId: "prod_1", unitAmountMinor: 50000, currency: "usd" }));
    expect(result.mapping.stripe_product_id).toBe("prod_1");
    expect(result.mapping.stripe_price_id).toBe("price_1");
    expect(result.mapping.synced_service_version_id).toBe("sv_1");
  });

  it("does not mint a new Price on a second sync when the published version hasn't changed", async () => {
    await syncServiceToStripeProduct("ws_1", "svc_1");
    fakeProvider.createPrice.mockClear();
    fakeProvider.createProduct.mockClear();

    const result = await syncServiceToStripeProduct("ws_1", "svc_1");
    expect(fakeProvider.createProduct).not.toHaveBeenCalled();
    expect(fakeProvider.createPrice).not.toHaveBeenCalled();
    expect(fakeProvider.updateProduct).toHaveBeenCalled();
    expect(result.mapping.stripe_price_id).toBe("price_1");
  });

  it("archives the old Price and mints a new one when a new version publishes", async () => {
    await syncServiceToStripeProduct("ws_1", "svc_1");

    vi.mocked(getService).mockResolvedValue({ ...fakeService, current_published_version_id: "sv_2" });
    fakeProvider.createPrice.mockResolvedValue({ id: "price_2" });

    const result = await syncServiceToStripeProduct("ws_1", "svc_1");
    expect(fakeProvider.archivePrice).toHaveBeenCalledWith("price_1");
    expect(result.mapping.stripe_price_id).toBe("price_2");
  });

  it("archives the Product and current Price when the Service is archived", async () => {
    await syncServiceToStripeProduct("ws_1", "svc_1");
    vi.mocked(getService).mockResolvedValue({ ...fakeService, status: "archived" });

    const result = await syncServiceToStripeProduct("ws_1", "svc_1");
    expect(fakeProvider.archiveProduct).toHaveBeenCalledWith("prod_1");
    expect(fakeProvider.archivePrice).toHaveBeenCalledWith("price_1");
    expect(result.archived).toBe(true);
  });
});

describe("getExistingStripeProductMapping", () => {
  it("returns null before any sync", () => {
    expect(getExistingStripeProductMapping("svc_1")).toBeNull();
  });
});
