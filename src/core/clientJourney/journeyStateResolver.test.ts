import { describe, it, expect } from "vitest";
import { resolveClientJourneyState, type JourneyStateSourceData } from "./journeyStateResolver";
import { makeLead, makeClient, makeProposal, makeContract, makeInvoice, makePayment, makeEvent, makeClientAccount, makeFinancialSummary } from "./testFixtures";

function baseLeadSource(overrides: Partial<JourneyStateSourceData> = {}): JourneyStateSourceData {
  return {
    subjectType: "lead",
    lead: makeLead(),
    client: null,
    proposals: [],
    contracts: [],
    invoices: [],
    payments: [],
    events: [],
    clientAccounts: [],
    financialSummary: null,
    latestManualTransition: null,
    ...overrides,
  };
}

function baseClientSource(overrides: Partial<JourneyStateSourceData> = {}): JourneyStateSourceData {
  return {
    subjectType: "client",
    lead: null,
    client: makeClient(),
    proposals: [],
    contracts: [],
    invoices: [],
    payments: [],
    events: [],
    clientAccounts: [],
    financialSummary: null,
    latestManualTransition: null,
    ...overrides,
  };
}

describe("resolveClientJourneyState", () => {
  it("resolves a brand-new lead to new_lead", () => {
    expect(resolveClientJourneyState(baseLeadSource()).stage).toBe("new_lead");
  });

  it("resolves a contacted lead to contacted", () => {
    const result = resolveClientJourneyState(baseLeadSource({ lead: makeLead({ status: "contacted" }) }));
    expect(result.stage).toBe("contacted");
  });

  it("resolves a lost lead to lost regardless of other facts", () => {
    const result = resolveClientJourneyState(baseLeadSource({ lead: makeLead({ status: "lost" }) }));
    expect(result.stage).toBe("lost");
  });

  it("resolves a bare client with no commercial records to qualified", () => {
    expect(resolveClientJourneyState(baseClientSource()).stage).toBe("qualified");
  });

  it("resolves a client with an unreviewed proposal draft to proposal_preparation", () => {
    const result = resolveClientJourneyState(baseClientSource({ proposals: [makeProposal({ reviewed_at: null })] }));
    expect(result.stage).toBe("proposal_preparation");
  });

  it("resolves a client with a reviewed proposal to proposal_sent", () => {
    const result = resolveClientJourneyState(baseClientSource({ proposals: [makeProposal({ reviewed_at: "2026-01-03T00:00:00.000Z" })] }));
    expect(result.stage).toBe("proposal_sent");
  });

  it("resolves a client with an accepted proposal to proposal_accepted", () => {
    const result = resolveClientJourneyState(baseClientSource({ proposals: [makeProposal({ status: "accepted", reviewed_at: "2026-01-03T00:00:00.000Z" })] }));
    expect(result.stage).toBe("proposal_accepted");
  });

  it("resolves a client with a signed contract but an unpaid deposit to contract_signed", () => {
    const result = resolveClientJourneyState(
      baseClientSource({
        proposals: [makeProposal({ status: "accepted", reviewed_at: "2026-01-03T00:00:00.000Z" })],
        contracts: [makeContract({ status: "signed", signature_status: "signed" })],
        financialSummary: makeFinancialSummary({ deposit_required_minor: 200000, deposit_balance_minor: 200000 }),
      }),
    );
    expect(result.stage).toBe("contract_signed");
  });

  it("resolves deposit_pending when an invoice is sent but the deposit is unpaid", () => {
    const result = resolveClientJourneyState(
      baseClientSource({
        proposals: [makeProposal({ status: "accepted", reviewed_at: "2026-01-03T00:00:00.000Z" })],
        contracts: [makeContract({ status: "signed", signature_status: "signed" })],
        invoices: [makeInvoice({ status: "sent", sent_at: "2026-01-05T00:00:00.000Z" })],
        financialSummary: makeFinancialSummary({ deposit_required_minor: 200000, deposit_balance_minor: 200000 }),
      }),
    );
    expect(result.stage).toBe("deposit_pending");
  });

  it("resolves deposit_paid once a succeeded deposit payment exists, even before the contract is signed", () => {
    const result = resolveClientJourneyState(
      baseClientSource({
        proposals: [makeProposal({ status: "accepted", reviewed_at: "2026-01-03T00:00:00.000Z" })],
        contracts: [makeContract({ status: "sent", signature_status: "sent" })],
        invoices: [makeInvoice({ status: "sent", sent_at: "2026-01-05T00:00:00.000Z" })],
        payments: [makePayment({ status: "succeeded", payment_type: "deposit" })],
        financialSummary: makeFinancialSummary({ deposit_required_minor: 200000, deposit_balance_minor: 0, deposit_paid_minor: 200000 }),
      }),
    );
    expect(result.stage).toBe("deposit_paid");
  });

  it("resolves welcome once proposal is accepted, contract is signed, and deposit is paid", () => {
    const result = resolveClientJourneyState(
      baseClientSource({
        proposals: [makeProposal({ status: "accepted", reviewed_at: "2026-01-03T00:00:00.000Z" })],
        contracts: [makeContract({ status: "signed", signature_status: "signed" })],
        invoices: [makeInvoice({ status: "sent", sent_at: "2026-01-05T00:00:00.000Z" })],
        payments: [makePayment({ status: "succeeded", payment_type: "deposit" })],
        financialSummary: makeFinancialSummary({ deposit_required_minor: 200000, deposit_balance_minor: 0, deposit_paid_minor: 200000 }),
      }),
    );
    expect(result.stage).toBe("welcome");
  });

  it("resolves portal_activated once an active Client Account exists", () => {
    const result = resolveClientJourneyState(
      baseClientSource({
        proposals: [makeProposal({ status: "accepted", reviewed_at: "2026-01-03T00:00:00.000Z" })],
        contracts: [makeContract({ status: "signed", signature_status: "signed" })],
        financialSummary: makeFinancialSummary({ deposit_required_minor: 0, deposit_balance_minor: 0 }),
        clientAccounts: [makeClientAccount({ status: "active" })],
      }),
    );
    expect(result.stage).toBe("portal_activated");
  });

  it("resolves closed once the event is completed with no outstanding balance", () => {
    const result = resolveClientJourneyState(
      baseClientSource({
        proposals: [makeProposal({ status: "accepted", reviewed_at: "2026-01-03T00:00:00.000Z" })],
        contracts: [makeContract({ status: "completed", signature_status: "signed" })],
        events: [makeEvent({ status: "completed" })],
        financialSummary: makeFinancialSummary({ deposit_required_minor: 0, deposit_balance_minor: 0, outstanding_minor: 0 }),
        clientAccounts: [makeClientAccount({ status: "active" })],
      }),
    );
    expect(result.stage).toBe("closed");
  });

  it("resolves final_balance_pending when the event is completed but a balance remains", () => {
    const result = resolveClientJourneyState(
      baseClientSource({
        events: [makeEvent({ status: "completed" })],
        financialSummary: makeFinancialSummary({ deposit_required_minor: 0, deposit_balance_minor: 0, outstanding_minor: 50000 }),
      }),
    );
    expect(result.stage).toBe("final_balance_pending");
  });

  it("resolves cancelled when the focus event is cancelled, overriding everything else", () => {
    const result = resolveClientJourneyState(
      baseClientSource({
        events: [makeEvent({ status: "cancelled" })],
        contracts: [makeContract({ status: "signed", signature_status: "signed" })],
      }),
    );
    expect(result.stage).toBe("cancelled");
  });

  it("never advances past closed without a recorded manual transition", () => {
    const result = resolveClientJourneyState(
      baseClientSource({
        events: [makeEvent({ status: "completed" })],
        financialSummary: makeFinancialSummary({ deposit_required_minor: 0, deposit_balance_minor: 0, outstanding_minor: 0 }),
      }),
    );
    expect(result.stage).toBe("closed");
  });

  it("advances past closed only when a manual transition explicitly recorded it", () => {
    const result = resolveClientJourneyState(
      baseClientSource({
        events: [makeEvent({ status: "completed" })],
        financialSummary: makeFinancialSummary({ deposit_required_minor: 0, deposit_balance_minor: 0, outstanding_minor: 0 }),
        latestManualTransition: {
          id: "t1",
          workspaceId: "workspace_1",
          subjectType: "client",
          subjectId: "client_1",
          type: "allowed",
          previousStage: "closed",
          newStage: "review_requested",
          trigger: "manual",
          sourceRecordId: null,
          actingMemberId: null,
          blockingRules: [],
          createdAt: "2026-02-01T00:00:00.000Z",
        },
      }),
    );
    expect(result.stage).toBe("review_requested");
  });
});
