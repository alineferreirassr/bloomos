import { beforeEach, describe, expect, it } from "vitest";
import {
  bookLead,
  createContract,
  createInvoice,
  createLead,
  createService,
  publishServiceVersion,
  activateService,
  assignServiceToEvent,
  getEventById,
  getClientById,
  getEventFinancialSummary,
  resetAllMockData,
  type BookLeadInput,
} from "@/lib/data";
import { getServiceAssignments, getAssignmentWorkspace } from "@/lib/queries/services";
import type { LeadFormInput } from "@/modules/leads/schema";

/**
 * Stabilization Checkpoint 1, Part 4 — protects the one path every other
 * feature in this app assumes works: a Lead becomes a Client, gets an
 * Event, the Event gets a Contract and gets invoiced, and a catalog
 * Service gets assigned to it. Each individual hop already has its own
 * focused coverage elsewhere (see docs/testing.md's "Critical-flow
 * coverage" table for exactly which file covers which hop already —
 * `bookLead`'s own edge cases in particular are NOT re-tested here). This
 * file only asserts the CONNECTIONS: that a record produced by one step is
 * actually accepted as valid input by the next, and that the composed
 * reads (`getEventFinancialSummary`, `getServiceAssignments`) genuinely
 * reflect data created several hops upstream — not a re-test of any single
 * module's own business rules.
 */

const validLead: LeadFormInput = {
  first_name: "Sasha",
  last_name: "Moreau",
  email: "sasha.moreau@example.com",
  phone: "",
  instagram: "",
  source: "Referral",
  event_type: "",
  event_date: "",
  location: "",
  budget_min: "",
  budget_max: "",
  message: "",
  assigned_to: "",
};

const eventSeed: BookLeadInput = {
  title: "Sasha & Partner's Proposal",
  event_type: "proposal",
  event_date: "",
  start_time: "",
  end_time: "",
  timezone: "",
  location_name: "",
  address: "",
  city: "",
  state: "",
  zip_code: "",
  latitude: "",
  longitude: "",
  guest_count: "",
  budget_min: "",
  budget_max: "",
  package_name: "",
  theme: "",
  color_palette: "",
  surprise_event: false,
  confidentiality_notes: "",
  accessibility_notes: "",
  dietary_notes: "",
  weather_plan: "",
  backup_location: "",
  internal_summary: "",
  assigned_owner: "",
  priority: "normal",
};

let bookingSequence = 0;

/** Each call produces a genuinely distinct Client — bookLead/convertLeadToClient dedupe by email, so reusing one address across calls (as the "two different Clients" tests need) would silently collapse them into one. */
async function bookLeadThroughToEvent() {
  bookingSequence += 1;
  const lead = await createLead({ ...validLead, email: `sasha.moreau+${bookingSequence}@example.com` });
  if (!lead.success) throw new Error("setup failed: createLead");
  const booked = await bookLead(lead.data.id, eventSeed);
  if (!booked.success) throw new Error(`setup failed: bookLead — ${booked.error}`);
  return booked.data; // { lead, client, event }
}

async function createPublishedActiveService() {
  const created = await createService({ category_id: null, name: "Live Music", description: null });
  if (!created.success) throw new Error("setup failed: createService");
  const published = await publishServiceVersion(created.data.id, { change_summary: "v1" });
  if (!published.success) throw new Error("setup failed: publishServiceVersion");
  const activated = await activateService(created.data.id);
  if (!activated.success) throw new Error("setup failed: activateService");
  return activated.data;
}

beforeEach(() => {
  resetAllMockData();
});

describe("Critical commercial flow — Lead → Client → Event → Contract → Finance → Service Assignment", () => {
  it("carries the same workspace_id through every hop, and every downstream record correctly references its upstream one", async () => {
    const { lead, client, event } = await bookLeadThroughToEvent();

    // Event → Client
    expect(event.client_id).toBe(client.id);
    expect(event.originating_lead_id).toBe(lead.id);

    // Contract → Event → Client
    const contract = await createContract({
      client_id: client.id,
      event_id: event.id,
      template_id: null,
      title: "Proposal Services Agreement",
      description: null,
      effective_date: null,
      expiration_date: null,
      total_value: 5000,
      deposit_required: true,
      deposit_amount: 1000,
      currency: "USD",
      notes: null,
    });
    expect(contract.success).toBe(true);
    if (!contract.success) return;
    expect(contract.data.event_id).toBe(event.id);
    expect(contract.data.client_id).toBe(client.id);

    // Invoice → Contract → Event → Client
    const invoice = await createInvoice({
      client_id: client.id,
      event_id: event.id,
      contract_id: contract.data.id,
      title: "Deposit Invoice",
      description: null,
      issue_date: null,
      due_date: null,
      subtotal_minor: 100000,
      tax_minor: 0,
      discount_minor: 0,
      currency: "USD",
      notes: null,
    }, crypto.randomUUID());
    expect(invoice.success).toBe(true);
    if (!invoice.success) return;
    expect(invoice.data.event_id).toBe(event.id);
    expect(invoice.data.contract_id).toBe(contract.data.id);
    expect(invoice.data.client_id).toBe(client.id);

    // Every record produced along the chain shares one workspace — this is
    // as much workspace-isolation coverage as the mock layer can express: it
    // models exactly one workspace (see docs/testing.md), so the real
    // cross-tenant boundary is enforced by RLS and is already covered by
    // each domain's own `supabaseRepository.test.ts` (every `.eq("workspace_id",
    // ...)` call recorded and asserted there). What's worth protecting HERE
    // is that nothing along this specific chain silently drops or
    // mismatches the workspace_id it was handed.
    const workspaceId = client.workspace_id;
    expect(lead.workspace_id).toBe(workspaceId);
    expect(event.workspace_id).toBe(workspaceId);
    expect(contract.data.workspace_id).toBe(workspaceId);
    expect(invoice.data.workspace_id).toBe(workspaceId);

    // Finance rolls the Contract + Invoice back up onto the Event.
    const summary = await getEventFinancialSummary(event.id);
    expect(summary.contracted_value_minor).toBeGreaterThan(0);
    expect(summary.invoiced_total_minor).toBe(100000);

    // Service Assignment → Event.
    const service = await createPublishedActiveService();
    const assignment = await assignServiceToEvent(event.id, { service_id: service.id, selected_add_on_ids: [] });
    expect(assignment.success).toBe(true);
    if (!assignment.success) return;
    expect(assignment.data.event_id).toBe(event.id);
    expect(assignment.data.workspace_id).toBe(workspaceId);

    // The two real read-composition points a UI screen actually calls each
    // independently reflect that same assignment — the Service-side
    // Assignments tab and the Event-side workspace lookup.
    const serviceAssignments = await getServiceAssignments(service.id);
    expect(serviceAssignments.rows.some((row) => row.eventService.id === assignment.data.id)).toBe(true);
    expect(serviceAssignments.rows.find((row) => row.eventService.id === assignment.data.id)?.event.id).toBe(event.id);

    const workspace = await getAssignmentWorkspace(event.id);
    expect(workspace.alreadyAssigned.some((eventService) => eventService.id === assignment.data.id)).toBe(true);
  });

  it("rejects a Contract for an Event that belongs to a different Client — the relationship is enforced, not assumed", async () => {
    const { client: firstClient } = await bookLeadThroughToEvent();
    const secondBooking = await bookLeadThroughToEvent();

    const result = await createContract({
      client_id: firstClient.id,
      event_id: secondBooking.event.id,
      template_id: null,
      title: "Mismatched Contract",
      description: null,
      effective_date: null,
      expiration_date: null,
      total_value: null,
      deposit_required: false,
      deposit_amount: null,
      currency: "USD",
      notes: null,
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toMatch(/doesn't belong to this client/i);
  });

  it("rejects an Invoice referencing a Contract that belongs to a different Client", async () => {
    const first = await bookLeadThroughToEvent();
    const second = await bookLeadThroughToEvent();

    const contract = await createContract({
      client_id: first.client.id,
      event_id: first.event.id,
      template_id: null,
      title: "First Client's Contract",
      description: null,
      effective_date: null,
      expiration_date: null,
      total_value: null,
      deposit_required: false,
      deposit_amount: null,
      currency: "USD",
      notes: null,
    });
    expect(contract.success).toBe(true);
    if (!contract.success) return;

    const invoice = await createInvoice({
      client_id: second.client.id,
      event_id: second.event.id,
      contract_id: contract.data.id,
      title: "Cross-client invoice attempt",
      description: null,
      issue_date: null,
      due_date: null,
      subtotal_minor: 5000,
      tax_minor: 0,
      discount_minor: 0,
      currency: "USD",
      notes: null,
    }, crypto.randomUUID());

    expect(invoice.success).toBe(false);
    if (invoice.success) return;
    expect(invoice.error).toMatch(/doesn't belong to this client/i);
  });

  it("a Service Assignment succeeds with no Contract or Invoice on the Event at all — assignment never implicitly depends on Finance state", async () => {
    // Confirms the connections are genuinely independent, not an implicit
    // chain — exactly the shape the architecture audit flagged as manual
    // (Event status and Contract status are not linked), verified here from
    // the other direction: assignment doesn't silently depend on it either.
    const { event } = await bookLeadThroughToEvent();
    const service = await createPublishedActiveService();

    const summaryBeforeAssignment = await getEventFinancialSummary(event.id);
    expect(summaryBeforeAssignment.contracted_value_minor).toBe(0);
    expect(summaryBeforeAssignment.invoiced_total_minor).toBe(0);

    const assignment = await assignServiceToEvent(event.id, { service_id: service.id, selected_add_on_ids: [] });
    expect(assignment.success).toBe(true);
    if (!assignment.success) return;

    const storedEvent = await getEventById(event.id);
    expect(storedEvent.id).toBe(event.id);
  });

  it("getEventFinancialSummary never counts a different Event's Contract or Invoice", async () => {
    const first = await bookLeadThroughToEvent();
    const second = await bookLeadThroughToEvent();

    await createInvoice({
      client_id: first.client.id,
      event_id: first.event.id,
      contract_id: null,
      title: "First Event's Invoice",
      description: null,
      issue_date: null,
      due_date: null,
      subtotal_minor: 250000,
      tax_minor: 0,
      discount_minor: 0,
      currency: "USD",
      notes: null,
    }, crypto.randomUUID());

    const secondSummary = await getEventFinancialSummary(second.event.id);
    expect(secondSummary.invoiced_total_minor).toBe(0);

    const firstSummary = await getEventFinancialSummary(first.event.id);
    expect(firstSummary.invoiced_total_minor).toBe(250000);
  });
});

describe("Critical commercial flow — Client identity confirmed once more (cross-check with LeadConversionService's own suite)", () => {
  it("looking a Client up by id after the full chain still resolves the same record bookLead produced", async () => {
    const { client } = await bookLeadThroughToEvent();
    const stored = await getClientById(client.id);
    expect(stored.id).toBe(client.id);
    expect(stored.originating_lead_id).not.toBeNull();
  });
});
