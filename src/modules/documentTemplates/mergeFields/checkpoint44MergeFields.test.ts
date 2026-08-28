import { afterEach, describe, expect, it, vi } from "vitest";
import { resetMergeFieldRegistry, listMergeFieldsByDomain } from "@/core/documents/mergeFieldRegistry";
import { resetMergeResolvers, resolveMergeFields } from "@/core/documents/mergeEngine";
import { registerMergeFields, resetMergeFieldsRegistration } from "@/modules/documentTemplates/registerMergeFields";
import type { MergeContext } from "@/types/documentPlatform";

// journeyMergeFields.ts imports buildClientJourney (modules/clientJourney/clientJourneyActions.ts),
// which transitively touches resolveMemberSessionSnapshot — mocked here the same way
// clientJourneyActions.test.ts itself does, so its own real Supabase-server import chain
// (only ever exercised inside a real Next.js server context) never loads under vitest.
vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(async () => ({ kind: "no-workspace" })),
}));

// journeyMergeFields.ts's buildClientJourney import reaches `@/lib/auth/workspaceSession`
// directly (not via memberSessionSnapshot) — a second, separate path to the server-only-guarded
// `@/lib/supabase/server` the mock above doesn't intercept. Mocked here per the Test Infra T1-B
// fix; never actually reached in mock-mode tests.
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

const baseContext: MergeContext = { workspaceId: "ws_44_test", memberId: "member_1" };

function reset(): void {
  resetMergeFieldRegistry();
  resetMergeResolvers();
  resetMergeFieldsRegistration();
}

afterEach(() => {
  reset();
});

describe("v2 Checkpoint 44 merge field domains", () => {
  it("registers every new domain with at least one field", () => {
    reset();
    registerMergeFields();
    for (const domain of ["lead", "vendor", "proposal", "payments", "journey", "brand", "timeline"] as const) {
      expect(listMergeFieldsByDomain(domain).length).toBeGreaterThan(0);
    }
  });

  it("lead fields resolve to null (never throw) when leadId is absent", async () => {
    reset();
    registerMergeFields();
    const scope = await resolveMergeFields(baseContext);
    expect(scope.lead_name).toBeNull();
    expect(scope.lead_email).toBeNull();
    expect(scope.lead_source).toBeNull();
    expect(scope.lead_event_type).toBeNull();
  });

  it("vendor fields resolve to null when vendorId is absent", async () => {
    reset();
    registerMergeFields();
    const scope = await resolveMergeFields(baseContext);
    expect(scope.vendor_name).toBeNull();
    expect(scope.vendor_contact_email).toBeNull();
    expect(scope.vendor_contact_phone).toBeNull();
  });

  it("proposal fields resolve to null when proposalId is absent", async () => {
    reset();
    registerMergeFields();
    const scope = await resolveMergeFields(baseContext);
    expect(scope.proposal_status).toBeNull();
    expect(scope.proposal_total).toBeNull();
    expect(scope.proposal_version).toBeNull();
  });

  it("payments fields resolve to null when invoiceId is absent", async () => {
    reset();
    registerMergeFields();
    const scope = await resolveMergeFields(baseContext);
    expect(scope.last_payment_amount).toBeNull();
    expect(scope.last_payment_date).toBeNull();
    expect(scope.last_payment_method).toBeNull();
  });

  it("journey fields resolve to null when clientId is absent", async () => {
    reset();
    registerMergeFields();
    const scope = await resolveMergeFields(baseContext);
    expect(scope.journey_stage).toBeNull();
    expect(scope.journey_progress_percent).toBeNull();
  });

  it("timeline fields resolve to null when clientId is absent", async () => {
    reset();
    registerMergeFields();
    const scope = await resolveMergeFields(baseContext);
    expect(scope.latest_activity_description).toBeNull();
    expect(scope.latest_activity_date).toBeNull();
  });

  it("brand fields resolve to real Settings-backed defaults regardless of context", async () => {
    reset();
    registerMergeFields();
    const scope = await resolveMergeFields(baseContext);
    expect(scope.brand_primary_color).toBe("#b68235");
    expect(scope.brand_logo_url).toBe("/brand/amore-bloom-app-logo.png");
    expect(typeof scope.brand_name).toBe("string");
  });

  it("registerMergeFields is idempotent — calling twice never double-registers a domain", () => {
    reset();
    registerMergeFields();
    registerMergeFields();
    expect(listMergeFieldsByDomain("lead").length).toBe(4);
  });
});
