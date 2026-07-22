import { afterEach, describe, expect, it } from "vitest";
import { mockVendorsRepository } from "@/lib/data/vendors/mockRepository";
import { resetVendorsStore, readVendors } from "@/lib/data/mock/vendorsStore";
import { resetNotesStore } from "@/lib/data/mock/notesStore";
import { NotFoundError } from "@/core/errors";
import type { CreateVendorInput } from "@/modules/vendors/schema";
import type { NoteFormInput } from "@/modules/notes/schema";

afterEach(() => {
  resetVendorsStore();
  resetNotesStore();
});

const MINIMAL_INPUT: CreateVendorInput = {
  company_name: "Studio Petal",
  display_name: null,
  contact_person: null,
  email: null,
  phone: null,
  website: null,
  tax_id: null,
  address: null,
  city: null,
  state: null,
  zip_code: null,
  country: null,
  notes: null,
  tags: [],
  default_currency: "USD",
  payment_terms: null,
};

describe("mockVendorsRepository.createVendor", () => {
  it("fails validation when company_name is blank", async () => {
    const result = await mockVendorsRepository.createVendor({ ...MINIMAL_INPUT, company_name: "  " });
    expect(result.success).toBe(false);
  });

  it("creates a minimal vendor with forced defaults (status=active, is_preferred=false)", async () => {
    const result = await mockVendorsRepository.createVendor(MINIMAL_INPUT);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.company_name).toBe("Studio Petal");
      expect(result.data.status).toBe("active");
      expect(result.data.is_preferred).toBe(false);
      expect(result.data.archived_at).toBeNull();
      expect(result.data.workspace_id).toBe("ws_amore_bloom");
    }
  });

  it("creates a complete vendor preserving every provided field", async () => {
    const result = await mockVendorsRepository.createVendor({
      ...MINIMAL_INPUT,
      display_name: "Petal Studio",
      contact_person: "Ana Reyes",
      email: "ana@studiopetal.example",
      phone: "+1-555-0199",
      website: "https://studiopetal.example",
      tax_id: "TAX-9999",
      address: "1 Rose St",
      city: "Austin",
      state: "TX",
      zip_code: "78701",
      country: "US",
      notes: "New supplier, on trial.",
      tags: ["florist", "trial"],
      payment_terms: "Net 15",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.display_name).toBe("Petal Studio");
      expect(result.data.tags).toEqual(["florist", "trial"]);
      expect(result.data.tax_id).toBe("TAX-9999");
    }
  });

  it("uppercases default_currency", async () => {
    const result = await mockVendorsRepository.createVendor({ ...MINIMAL_INPUT, default_currency: "usd" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.default_currency).toBe("USD");
    }
  });

  it("rejects a duplicate non-null Tax ID within the same workspace", async () => {
    const result = await mockVendorsRepository.createVendor({ ...MINIMAL_INPUT, tax_id: "TAX-10001" }); // collides with seeded vendor_1
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.fieldErrors?.tax_id).toBeTruthy();
    }
  });

  it("allows multiple vendors with a null Tax ID", async () => {
    const first = await mockVendorsRepository.createVendor(MINIMAL_INPUT);
    const second = await mockVendorsRepository.createVendor({ ...MINIMAL_INPUT, company_name: "Second Vendor" });
    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
  });
});

describe("mockVendorsRepository.getVendorById / getVendors", () => {
  it("returns a seeded vendor by id", async () => {
    const vendor = await mockVendorsRepository.getVendorById("vendor_1");
    expect(vendor.company_name).toBe("Bloom & Stem Florals");
  });

  it("throws NotFoundError for a missing vendor", async () => {
    await expect(mockVendorsRepository.getVendorById("missing")).rejects.toThrow(NotFoundError);
  });

  it("excludes archived vendors by default", async () => {
    const vendors = await mockVendorsRepository.getVendors();
    expect(vendors.some((v) => v.id === "vendor_3")).toBe(false);
  });

  it("includes archived vendors when includeArchived is true", async () => {
    const vendors = await mockVendorsRepository.getVendors({ includeArchived: true });
    expect(vendors.some((v) => v.id === "vendor_3")).toBe(true);
  });

  it("filters by status", async () => {
    const vendors = await mockVendorsRepository.getVendors({ status: "active" });
    expect(vendors.every((v) => v.status === "active")).toBe(true);
  });

  it("filters by isPreferred", async () => {
    const vendors = await mockVendorsRepository.getVendors({ isPreferred: true });
    expect(vendors.every((v) => v.is_preferred)).toBe(true);
    expect(vendors.some((v) => v.id === "vendor_1")).toBe(true);
  });

  it("filters by tags", async () => {
    const vendors = await mockVendorsRepository.getVendors({ tags: ["candles"] });
    expect(vendors.map((v) => v.id)).toEqual(["vendor_2"]);
  });

  it("searches across company name, display name, contact person, email, phone, tax ID", async () => {
    const vendors = await mockVendorsRepository.getVendors({ search: "Marcus" });
    expect(vendors.map((v) => v.id)).toEqual(["vendor_2"]);
  });

  it("sorts by the requested field and direction", async () => {
    const ascending = await mockVendorsRepository.getVendors({}, { sortBy: "company_name", sortDirection: "asc" });
    const names = ascending.map((v) => v.company_name);
    expect(names).toEqual([...names].sort());
  });

  it("enforces workspace isolation — every returned vendor belongs to the current workspace", async () => {
    const vendors = await mockVendorsRepository.getVendors({ includeArchived: true });
    expect(vendors.every((v) => v.workspace_id === "ws_amore_bloom")).toBe(true);
  });
});

describe("mockVendorsRepository.updateVendor", () => {
  it("fails when the vendor does not exist", async () => {
    const result = await mockVendorsRepository.updateVendor("missing", { company_name: "New Name" });
    expect(result.success).toBe(false);
  });

  it("writes only the provided fields, leaving unspecified fields untouched", async () => {
    const before = await mockVendorsRepository.getVendorById("vendor_2");
    const result = await mockVendorsRepository.updateVendor("vendor_2", { company_name: "Candlelight Company" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.company_name).toBe("Candlelight Company");
      expect(result.data.contact_person).toBe(before.contact_person);
      expect(result.data.tags).toEqual(before.tags);
    }
  });

  it("is a no-op when the input has no fields", async () => {
    const before = await mockVendorsRepository.getVendorById("vendor_2");
    const result = await mockVendorsRepository.updateVendor("vendor_2", {});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.updated_at).toBe(before.updated_at);
    }
  });

  it("rejects a Tax ID update that collides with a different vendor in the same workspace", async () => {
    const result = await mockVendorsRepository.updateVendor("vendor_2", { tax_id: "TAX-10001" }); // vendor_1's tax_id
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.fieldErrors?.tax_id).toBeTruthy();
    }
  });

  it("allows a vendor to keep its own existing Tax ID unchanged", async () => {
    const result = await mockVendorsRepository.updateVendor("vendor_1", { tax_id: "TAX-10001", notes: "unchanged tax id, new notes" });
    expect(result.success).toBe(true);
  });
});

describe("mockVendorsRepository.archiveVendor / restoreVendor", () => {
  it("archiveVendor fails when already archived", async () => {
    const result = await mockVendorsRepository.archiveVendor("vendor_3");
    expect(result.success).toBe(false);
  });

  it("archiveVendor sets archived_at and excludes it from the default list", async () => {
    const result = await mockVendorsRepository.archiveVendor("vendor_1");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.archived_at).not.toBeNull();
    }
    const vendors = await mockVendorsRepository.getVendors();
    expect(vendors.some((v) => v.id === "vendor_1")).toBe(false);
  });

  it("restoreVendor fails when not archived", async () => {
    const result = await mockVendorsRepository.restoreVendor("vendor_1");
    expect(result.success).toBe(false);
  });

  it("restoreVendor clears archived_at and no physical deletion ever occurs", async () => {
    const before = readVendors().length;
    const result = await mockVendorsRepository.restoreVendor("vendor_3");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.archived_at).toBeNull();
    }
    expect(readVendors().length).toBe(before);
  });
});

describe("mockVendorsRepository.setVendorStatus", () => {
  it("changes status", async () => {
    const result = await mockVendorsRepository.setVendorStatus("vendor_1", "inactive");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("inactive");
    }
  });

  it("is a no-op when the status is already equal", async () => {
    const before = await mockVendorsRepository.getVendorById("vendor_1");
    const result = await mockVendorsRepository.setVendorStatus("vendor_1", "active");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.updated_at).toBe(before.updated_at);
    }
  });
});

describe("mockVendorsRepository.setVendorPreferredStatus", () => {
  it("changes preferred status", async () => {
    const result = await mockVendorsRepository.setVendorPreferredStatus("vendor_2", true);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.is_preferred).toBe(true);
    }
  });

  it("is a no-op when the preferred value is already equal", async () => {
    const before = await mockVendorsRepository.getVendorById("vendor_1");
    const result = await mockVendorsRepository.setVendorPreferredStatus("vendor_1", true);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.updated_at).toBe(before.updated_at);
    }
  });
});

describe("mockVendorsRepository.getTimelineByVendorId", () => {
  it("returns activities recorded by create/update/archive/restore/preferred-status calls", async () => {
    const created = await mockVendorsRepository.createVendor({
      company_name: "Timeline Test Vendor",
      display_name: null,
      contact_person: null,
      email: null,
      phone: null,
      website: null,
      tax_id: null,
      address: null,
      city: null,
      state: null,
      zip_code: null,
      country: null,
      notes: null,
      tags: [],
      default_currency: "USD",
      payment_terms: null,
    });
    expect(created.success).toBe(true);
    if (!created.success) return;

    await mockVendorsRepository.archiveVendor(created.data.id);
    const timeline = await mockVendorsRepository.getTimelineByVendorId(created.data.id);

    expect(timeline.some((activity) => (activity.type as string) === "vendor_created")).toBe(true);
    expect(timeline.some((activity) => (activity.type as string) === "vendor_archived")).toBe(true);
    expect(timeline.every((activity) => activity.owner_type === "vendor" && activity.owner_id === created.data.id)).toBe(true);
  });

  it("returns an empty array for a vendor that does not exist", async () => {
    const timeline = await mockVendorsRepository.getTimelineByVendorId("missing");
    expect(timeline).toEqual([]);
  });
});

const NOTE_INPUT: NoteFormInput = {
  title: "Delivery preference",
  content: "Prefers morning deliveries.",
  category: "general",
  priority: "normal",
};

describe("mockVendorsRepository Notes methods", () => {
  async function createTestVendor() {
    const created = await mockVendorsRepository.createVendor(MINIMAL_INPUT);
    expect(created.success).toBe(true);
    if (!created.success) throw new Error("setup failed");
    return created.data;
  }

  it("getNotesByVendorId returns an empty array for a vendor with no notes", async () => {
    const vendor = await createTestVendor();
    const notes = await mockVendorsRepository.getNotesByVendorId(vendor.id);
    expect(notes).toEqual([]);
  });

  it("getNotesByVendorId returns an empty array for a vendor that does not exist", async () => {
    const notes = await mockVendorsRepository.getNotesByVendorId("missing");
    expect(notes).toEqual([]);
  });

  it("createVendorNote writes through the shared mock Notes store, scoped to the vendor's workspace and owner", async () => {
    const vendor = await createTestVendor();
    const result = await mockVendorsRepository.createVendorNote(vendor.id, NOTE_INPUT);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.owner_type).toBe("vendor");
    expect(result.data.owner_id).toBe(vendor.id);
    expect(result.data.workspace_id).toBe(vendor.workspace_id);
    expect(result.data.title).toBe("Delivery preference");

    const notes = await mockVendorsRepository.getNotesByVendorId(vendor.id);
    expect(notes).toHaveLength(1);
    expect(notes[0].id).toBe(result.data.id);
  });

  it("createVendorNote fails for a vendor that does not exist", async () => {
    const result = await mockVendorsRepository.createVendorNote("missing", NOTE_INPUT);
    expect(result.success).toBe(false);
  });

  it("updateVendorNote edits an existing note's content", async () => {
    const vendor = await createTestVendor();
    const created = await mockVendorsRepository.createVendorNote(vendor.id, NOTE_INPUT);
    expect(created.success).toBe(true);
    if (!created.success) return;

    const updated = await mockVendorsRepository.updateVendorNote(created.data.id, {
      ...NOTE_INPUT,
      title: "Updated title",
      content: "Updated content",
    });

    expect(updated).not.toBeNull();
    expect(updated?.success).toBe(true);
    if (!updated || !updated.success) return;
    expect(updated.data.title).toBe("Updated title");
    expect(updated.data.content).toBe("Updated content");

    const notes = await mockVendorsRepository.getNotesByVendorId(vendor.id);
    expect(notes[0].title).toBe("Updated title");
  });

  it("updateVendorNote returns null for a note that does not exist", async () => {
    const result = await mockVendorsRepository.updateVendorNote("missing", NOTE_INPUT);
    expect(result).toBeNull();
  });

  it("toggleVendorNotePin flips a note's pinned state", async () => {
    const vendor = await createTestVendor();
    const created = await mockVendorsRepository.createVendorNote(vendor.id, NOTE_INPUT);
    expect(created.success).toBe(true);
    if (!created.success) return;

    const pinned = await mockVendorsRepository.toggleVendorNotePin(created.data.id);
    expect(pinned?.success).toBe(true);
    if (!pinned || !pinned.success) return;
    expect(pinned.data.is_pinned).toBe(true);

    const unpinned = await mockVendorsRepository.toggleVendorNotePin(created.data.id);
    expect(unpinned?.success).toBe(true);
    if (!unpinned || !unpinned.success) return;
    expect(unpinned.data.is_pinned).toBe(false);
  });

  it("toggleVendorNotePin returns null for a note that does not exist", async () => {
    const result = await mockVendorsRepository.toggleVendorNotePin("missing");
    expect(result).toBeNull();
  });
});
