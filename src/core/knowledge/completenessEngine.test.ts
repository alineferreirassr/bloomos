import { describe, expect, it } from "vitest";
import { evaluateProposalCompleteness, evaluateEventCompleteness, evaluateClientCompleteness, evaluateVendorCompleteness } from "@/core/knowledge/completenessEngine";
import { makeEvent, makeChecklistItem, makeScheduleItem } from "@/modules/events/testUtils";
import { makeClient } from "@/modules/clients/testUtils";
import { makeVendor } from "@/modules/vendors/testUtils";
import { makeContract } from "@/modules/contracts/testUtils";
import { makeDocument } from "@/modules/documents/testUtils";
import { makeInvoice } from "@/modules/finance/testUtils";
import type { KnowledgeRelationship } from "@/types/knowledgeGraph";
import type { ProposalDraft } from "@/types/proposal";
import type { MediaAsset } from "@/types/mediaAsset";
import type { EventServiceVendorAssignment } from "@/types/eventServiceVendorAssignment";

function makeRel(overrides: Partial<KnowledgeRelationship> & Pick<KnowledgeRelationship, "source_node_type" | "source_node_id" | "target_node_type" | "target_node_id" | "relationship_type">): KnowledgeRelationship {
  return {
    id: `rel_${Math.random()}`,
    workspace_id: "ws_1",
    created_by: "member_1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    status: "active",
    confidence: 100,
    source: "user_action",
    notes: null,
    metadata: {},
    start_date: null,
    end_date: null,
    semantics: null,
    ...overrides,
  };
}

function makeProposal(overrides: Partial<ProposalDraft> = {}): ProposalDraft {
  return {
    id: "proposal_1",
    workspace_id: "ws_1",
    event_id: "event_1",
    client_id: "client_1",
    status: "draft",
    version: 1,
    parent_proposal_id: null,
    executive_summary: "",
    event_overview: "",
    services_included: [],
    timeline_summary: "",
    pricing_summary: { subtotal_minor: 0, currency: "usd" },
    payment_terms: [],
    recommendations: [],
    optional_add_ons: [],
    questions_for_client: [],
    ai_confidence: 100,
    missing_information: [],
    provider: "mock",
    model: "mock",
    prompt_version: "v1",
    mock: true,
    generation_latency_ms: 0,
    generated_at: "2026-01-01T00:00:00.000Z",
    reviewed_by: null,
    reviewed_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeAsset(overrides: Partial<MediaAsset> & Pick<MediaAsset, "id">): MediaAsset {
  return {
    workspace_id: "ws_1",
    owner_type: "event",
    owner_id: "event_1",
    original_filename: `${overrides.id}.jpg`,
    stored_filename: `${overrides.id}.jpg`,
    storage_bucket: "media-assets",
    storage_path: `ws_1/event/event_1/${overrides.id}/1/${overrides.id}.jpg`,
    mime_type: "image/jpeg",
    extension: "jpg",
    file_size: 100,
    checksum: "abc",
    width: null,
    height: null,
    duration: null,
    version: 1,
    uploaded_by: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    archived_at: null,
    folder_id: null,
    tags: [],
    color_label: null,
    priority: null,
    ai_ready: false,
    status: "pending",
    approved_by: null,
    approved_at: null,
    rejection_reason: null,
    version_notes: null,
    metadata: { pages: null, author: null, license: null, brand: null, colorProfile: null, cameraData: null, location: null, custom: {} },
    ...overrides,
  };
}

function makeVendorAssignment(overrides: Partial<EventServiceVendorAssignment> = {}): EventServiceVendorAssignment {
  return {
    id: "assignment_1",
    workspace_id: "ws_1",
    event_service_id: "event_service_1",
    vendor_id: "vendor_1",
    status: "suggested",
    note: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("evaluateProposalCompleteness", () => {
  it("flags every missing requirement for a bare draft proposal", () => {
    const proposal = makeProposal();
    const result = evaluateProposalCompleteness({ proposal, relationships: [], documents: [] });
    expect(result.missingRequirements).toEqual(["Missing Hero Image", "Missing Contract", "Missing Pricing", "Missing Approval", "Missing Attachments"]);
    expect(result.score).toBe(0);
  });

  it("scores 100 when every requirement is satisfied", () => {
    const proposal = makeProposal({ status: "accepted", pricing_summary: { subtotal_minor: 500000, currency: "usd" } });
    const relationships = [
      makeRel({
        source_node_type: "media_asset",
        source_node_id: "asset_1",
        target_node_type: "proposal",
        target_node_id: proposal.id,
        relationship_type: "used_by",
        semantics: { role: "hero_image", businessMeaning: null, category: null, importance: null, priority: null, lifecycle: null, visibility: null, ownerMemberId: null, businessContext: null },
      }),
      makeRel({ source_node_type: "contract", source_node_id: "contract_1", target_node_type: "proposal", target_node_id: proposal.id, relationship_type: "referenced_by" }),
    ];
    const result = evaluateProposalCompleteness({ proposal, relationships, documents: [makeDocument()] });
    expect(result.missingRequirements).toEqual([]);
    expect(result.score).toBe(100);
  });

  it("does not count a hero-image edge belonging to a different proposal", () => {
    const proposal = makeProposal();
    const relationships = [
      makeRel({
        source_node_type: "media_asset",
        source_node_id: "asset_1",
        target_node_type: "proposal",
        target_node_id: "some_other_proposal",
        relationship_type: "used_by",
        semantics: { role: "hero_image", businessMeaning: null, category: null, importance: null, priority: null, lifecycle: null, visibility: null, ownerMemberId: null, businessContext: null },
      }),
    ];
    const result = evaluateProposalCompleteness({ proposal, relationships, documents: [] });
    expect(result.missingRequirements).toContain("Missing Hero Image");
  });
});

describe("evaluateEventCompleteness", () => {
  it("flags every missing requirement for a bare event", () => {
    const event = makeEvent({ assigned_owner: null });
    const result = evaluateEventCompleteness({ event, scheduleItems: [], vendorAssignments: [], checklistItems: [], invoices: [], assets: [] });
    expect(result.missingRequirements).toEqual(["Missing Timeline", "Missing Vendor", "Missing Checklist", "Missing Payment", "Missing Assets", "Missing Team"]);
    expect(result.score).toBe(0);
  });

  it("scores 100 when every requirement is satisfied", () => {
    const event = makeEvent({ assigned_owner: "member_1" });
    const result = evaluateEventCompleteness({
      event,
      scheduleItems: [makeScheduleItem()],
      vendorAssignments: [makeVendorAssignment()],
      checklistItems: [makeChecklistItem()],
      invoices: [makeInvoice()],
      assets: [makeAsset({ id: "asset_1" })],
    });
    expect(result.missingRequirements).toEqual([]);
    expect(result.score).toBe(100);
  });
});

describe("evaluateClientCompleteness", () => {
  it("flags every missing requirement for a bare client", () => {
    const client = makeClient({ phone: null });
    const result = evaluateClientCompleteness({ client, contracts: [], documents: [] });
    expect(result.missingRequirements).toEqual(["Missing Contact Information", "Missing Signed Agreement", "Missing Documents"]);
    expect(result.score).toBe(0);
  });

  it("only counts a signed contract, not an unsigned one", () => {
    const client = makeClient({ phone: "555-0100" });
    const unsigned = makeContract({ signature_status: "unsigned" });
    const result = evaluateClientCompleteness({ client, contracts: [unsigned], documents: [makeDocument()] });
    expect(result.missingRequirements).toContain("Missing Signed Agreement");
  });

  it("scores 100 when every requirement is satisfied", () => {
    const client = makeClient({ phone: "555-0100" });
    const signed = makeContract({ signature_status: "signed" });
    const result = evaluateClientCompleteness({ client, contracts: [signed], documents: [makeDocument()] });
    expect(result.missingRequirements).toEqual([]);
    expect(result.score).toBe(100);
  });
});

describe("evaluateVendorCompleteness", () => {
  it("flags an inactive vendor with no contact info", () => {
    const vendor = makeVendor({ status: "inactive", email: null, phone: null });
    const result = evaluateVendorCompleteness({ vendor });
    expect(result.missingRequirements).toEqual(["Vendor Is Inactive", "Missing Contact Information"]);
  });

  it("scores 100 for an active vendor with at least one contact channel", () => {
    const vendor = makeVendor({ status: "active", email: "vendor@example.com", phone: null });
    const result = evaluateVendorCompleteness({ vendor });
    expect(result.missingRequirements).toEqual([]);
    expect(result.score).toBe(100);
  });
});
