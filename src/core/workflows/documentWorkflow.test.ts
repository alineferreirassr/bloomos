import { describe, expect, it } from "vitest";
import {
  canTransitionDocumentStatus,
  getNextDocumentStatuses,
  isDocumentTerminal,
  getDocumentNextRecommendedAction,
} from "@/core/workflows/documentWorkflow";

describe("canTransitionDocumentStatus", () => {
  it("allows draft -> active, archived, deleted", () => {
    for (const to of ["active", "archived", "deleted"] as const) {
      expect(canTransitionDocumentStatus("draft", to)).toBe(true);
    }
  });

  it("allows active -> superseded, expired, archived, deleted", () => {
    for (const to of ["superseded", "expired", "archived", "deleted"] as const) {
      expect(canTransitionDocumentStatus("active", to)).toBe(true);
    }
  });

  it("disallows draft -> superseded directly", () => {
    expect(canTransitionDocumentStatus("draft", "superseded")).toBe(false);
  });

  it("allows archived -> active (restore)", () => {
    expect(canTransitionDocumentStatus("archived", "active")).toBe(true);
  });

  it("allows deleted -> active (restore)", () => {
    expect(canTransitionDocumentStatus("deleted", "active")).toBe(true);
  });

  it("disallows a status transitioning to itself", () => {
    expect(canTransitionDocumentStatus("active", "active")).toBe(false);
  });
});

describe("getNextDocumentStatuses", () => {
  it("returns the full transition set for draft", () => {
    expect(getNextDocumentStatuses("draft")).toEqual(["active", "archived", "deleted"]);
  });
});

describe("isDocumentTerminal", () => {
  it("is true only for deleted", () => {
    expect(isDocumentTerminal("deleted")).toBe(true);
  });

  it("is false for draft/active/superseded/expired/archived", () => {
    for (const status of ["draft", "active", "superseded", "expired", "archived"] as const) {
      expect(isDocumentTerminal(status)).toBe(false);
    }
  });
});

describe("getDocumentNextRecommendedAction", () => {
  it("returns null for the terminal deleted status", () => {
    expect(
      getDocumentNextRecommendedAction({ status: "deleted", category: "other", folder_id: null, expires_at: null }),
    ).toBeNull();
  });

  it("flags incomplete metadata for an uncategorized, unfiled draft", () => {
    expect(
      getDocumentNextRecommendedAction({ status: "draft", category: "other", folder_id: null, expires_at: null }),
    ).toMatch(/complete required metadata/i);
  });

  it("recommends activating a draft with complete metadata", () => {
    expect(
      getDocumentNextRecommendedAction({
        status: "draft",
        category: "contract",
        folder_id: "docfolder_1",
        expires_at: null,
      }),
    ).toMatch(/activate/i);
  });

  it("returns null for an active document with no expiration", () => {
    expect(
      getDocumentNextRecommendedAction({ status: "active", category: "contract", folder_id: null, expires_at: null }),
    ).toBeNull();
  });

  it("flags an active document expiring soon", () => {
    const soon = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    expect(
      getDocumentNextRecommendedAction({ status: "active", category: "insurance", folder_id: null, expires_at: soon }),
    ).toMatch(/expires soon/i);
  });

  it("returns null for an active document expiring well in the future", () => {
    const farFuture = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
    expect(
      getDocumentNextRecommendedAction({
        status: "active",
        category: "insurance",
        folder_id: null,
        expires_at: farFuture,
      }),
    ).toBeNull();
  });

  it("gives a history note for a superseded document", () => {
    expect(
      getDocumentNextRecommendedAction({ status: "superseded", category: "contract", folder_id: null, expires_at: null }),
    ).toMatch(/kept for history/i);
  });

  it("recommends replacing or archiving an expired document", () => {
    expect(
      getDocumentNextRecommendedAction({ status: "expired", category: "policy", folder_id: null, expires_at: null }),
    ).toMatch(/expired/i);
  });

  it("recommends restoring an archived document", () => {
    expect(
      getDocumentNextRecommendedAction({ status: "archived", category: "report", folder_id: null, expires_at: null }),
    ).toMatch(/restore/i);
  });
});
