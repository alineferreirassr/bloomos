import { describe, it, expect } from "vitest";
import { evaluateStageRequirements, type RequirementsSourceData } from "./journeyRequirementsEngine";
import { makeLead, makeClient, makeProposal, makeContract, makeInvoice, makeEvent } from "./testFixtures";

function baseSource(overrides: Partial<RequirementsSourceData> = {}): RequirementsSourceData {
  return {
    lead: makeLead(),
    client: makeClient(),
    proposal: null,
    acceptedProposal: null,
    contract: null,
    invoice: null,
    focusEvent: null,
    clientAccounts: [],
    depositRequired: false,
    depositSatisfied: true,
    operationalReadinessScore: null,
    requiredDocumentsComplete: null,
    ...overrides,
  };
}

describe("evaluateStageRequirements", () => {
  it("returns an empty list for a stage the spec doesn't name", () => {
    expect(evaluateStageRequirements("planning", baseSource())).toEqual([]);
  });

  it("qualified: flags incomplete lead information", () => {
    const results = evaluateStageRequirements("qualified", baseSource({ lead: makeLead({ first_name: "", email: "", phone: null }) }));
    const infoReq = results.find((r) => r.key === "lead_information_complete");
    expect(infoReq?.met).toBe(false);
  });

  it("proposal_sent: fails when there is no proposal at all", () => {
    const results = evaluateStageRequirements("proposal_sent", baseSource());
    expect(results.every((r) => !r.met)).toBe(true);
  });

  it("proposal_sent: passes every check for a complete, reviewed proposal", () => {
    const proposal = makeProposal({ reviewed_at: "2026-01-03T00:00:00.000Z" });
    const results = evaluateStageRequirements("proposal_sent", baseSource({ proposal }));
    expect(results.every((r) => r.met)).toBe(true);
  });

  it("contract_sent: fails when no accepted proposal exists", () => {
    const results = evaluateStageRequirements("contract_sent", baseSource());
    const accepted = results.find((r) => r.key === "accepted_proposal_exists");
    expect(accepted?.met).toBe(false);
  });

  it("contract_signed: signature_status drives both signature-related checks", () => {
    const results = evaluateStageRequirements("contract_signed", baseSource({ contract: makeContract({ signature_status: "signed" }) }));
    expect(results.find((r) => r.key === "signature_status_completed")?.met).toBe(true);
    expect(results.find((r) => r.key === "required_signers_completed")?.met).toBe(true);
  });

  it("invoice_sent: flags a missing due date", () => {
    const results = evaluateStageRequirements("invoice_sent", baseSource({ invoice: makeInvoice({ due_date: null }) }));
    expect(results.find((r) => r.key === "due_date_exists")?.met).toBe(false);
  });

  it("welcome: client_portal_account_ready is always satisfied (checked at its own stage instead)", () => {
    const results = evaluateStageRequirements("welcome", baseSource());
    expect(results.find((r) => r.key === "client_portal_account_ready")?.met).toBe(true);
  });

  it("ready_for_service: operational_requirements_complete reuses the caller-supplied readiness score, never recalculating it", () => {
    const results = evaluateStageRequirements("ready_for_service", baseSource({ operationalReadinessScore: 40, focusEvent: makeEvent({ status: "ready" }) }));
    expect(results.find((r) => r.key === "operational_requirements_complete")?.met).toBe(false);
  });

  it("ready_for_service: treats a null readiness score as satisfied, not as a fabricated failure", () => {
    const results = evaluateStageRequirements("ready_for_service", baseSource({ operationalReadinessScore: null }));
    expect(results.find((r) => r.key === "operational_requirements_complete")?.met).toBe(true);
  });
});
