import { describe, expect, it } from "vitest";
import {
  canTransitionServiceStatus,
  canAssignService,
  canEditServiceVersionTemplates,
  canEditServiceCatalogFields,
  computeNextServiceVersionNumber,
  canPublishServiceVersion,
} from "@/core/workflows/serviceWorkflow";

describe("canTransitionServiceStatus", () => {
  it("allows draft to move to active or archived", () => {
    expect(canTransitionServiceStatus("draft", "active")).toBe(true);
    expect(canTransitionServiceStatus("draft", "archived")).toBe(true);
  });

  it("rejects transitioning to the same status", () => {
    expect(canTransitionServiceStatus("active", "active")).toBe(false);
  });

  it("allows active to move to inactive or archived, and back", () => {
    expect(canTransitionServiceStatus("active", "inactive")).toBe(true);
    expect(canTransitionServiceStatus("inactive", "active")).toBe(true);
  });

  it("rejects draft moving directly to inactive", () => {
    expect(canTransitionServiceStatus("draft", "inactive")).toBe(false);
  });

  it("allows archived to be restored only to draft", () => {
    expect(canTransitionServiceStatus("archived", "draft")).toBe(true);
    expect(canTransitionServiceStatus("archived", "active")).toBe(false);
  });
});

describe("canAssignService", () => {
  it("requires active status and a published version", () => {
    expect(canAssignService({ status: "active", current_published_version_id: "v1" })).toBe(true);
  });

  it("rejects an active Service with no published version", () => {
    expect(canAssignService({ status: "active", current_published_version_id: null })).toBe(false);
  });

  it("rejects an inactive Service even with a published version", () => {
    expect(canAssignService({ status: "inactive", current_published_version_id: "v1" })).toBe(false);
  });
});

describe("canEditServiceVersionTemplates", () => {
  it("allows editing while draft", () => {
    expect(canEditServiceVersionTemplates({ status: "draft" })).toBe(true);
  });
  it("rejects editing once published", () => {
    expect(canEditServiceVersionTemplates({ status: "published" })).toBe(false);
  });
});

describe("canEditServiceCatalogFields", () => {
  it("allows editing any non-archived status", () => {
    expect(canEditServiceCatalogFields({ status: "draft" })).toBe(true);
    expect(canEditServiceCatalogFields({ status: "active" })).toBe(true);
    expect(canEditServiceCatalogFields({ status: "inactive" })).toBe(true);
  });
  it("rejects editing an archived Service", () => {
    expect(canEditServiceCatalogFields({ status: "archived" })).toBe(false);
  });
});

describe("computeNextServiceVersionNumber", () => {
  it("returns 1 for a Service with no prior versions", () => {
    expect(computeNextServiceVersionNumber([])).toBe(1);
  });
  it("ignores null (draft) version numbers", () => {
    expect(computeNextServiceVersionNumber([null, null])).toBe(1);
  });
  it("returns one past the highest published version number", () => {
    expect(computeNextServiceVersionNumber([1, 2, null])).toBe(3);
  });
});

describe("canPublishServiceVersion", () => {
  it("allows a well-formed draft", () => {
    expect(canPublishServiceVersion({ status: "draft", base_price_minor: 1000 })).toBeNull();
  });
  it("rejects a version that isn't a draft", () => {
    expect(canPublishServiceVersion({ status: "published", base_price_minor: 1000 })).not.toBeNull();
  });
  it("rejects a negative base price", () => {
    expect(canPublishServiceVersion({ status: "draft", base_price_minor: -1 })).not.toBeNull();
  });
});
