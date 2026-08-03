import type { KnowledgeRelationship, KnowledgeNodeRef } from "@/types/knowledgeGraph";
import type { CompletenessResult } from "@/types/businessHealth";
import type { ProposalDraft } from "@/types/proposal";
import type { Event } from "@/types/event";
import type { Client } from "@/types/client";
import type { Vendor } from "@/types/vendor";
import type { Contract } from "@/types/contract";
import type { Document } from "@/types/document";
import type { EventScheduleItem } from "@/types/eventScheduleItem";
import type { ChecklistItem } from "@/types/checklistItem";
import type { Invoice } from "@/types/invoice";
import type { MediaAsset } from "@/types/mediaAsset";
import type { EventServiceVendorAssignment } from "@/types/eventServiceVendorAssignment";

/**
 * v2.0 Checkpoint 25, Step 15.5 — CompletenessEngine. Every check here is a
 * plain boolean condition over already-fetched records (the module layer
 * fetches everything; this file has no data access), matching the
 * deterministic-only discipline the whole Knowledge Graph area of this
 * checkpoint follows. Field names are verified against the real types —
 * see `docs/business-health-engine.md` for a field-by-field citation of
 * what each check reads.
 *
 * Where a requirement is naturally expressed as a graph relationship (a
 * Hero Image, a linked Contract) the check reads the Knowledge Graph
 * directly rather than inventing a parallel field — the same "the graph is
 * the single source of connection facts" discipline `docs/knowledge-graph.md`
 * establishes.
 */

function relationshipCount(node: KnowledgeNodeRef, relationships: KnowledgeRelationship[], predicate: (r: KnowledgeRelationship) => boolean): number {
  return relationships.filter((r) => r.status === "active" && predicate(r)).length;
}

function hasInboundRoleEdge(node: KnowledgeNodeRef, relationships: KnowledgeRelationship[], role: string): boolean {
  return (
    relationshipCount(node, relationships, (r) => r.target_node_type === node.nodeType && r.target_node_id === node.nodeId && r.semantics?.role === role) > 0
  );
}

// ---------------------------------------------------------------------------
// Proposal Completeness
// ---------------------------------------------------------------------------

export interface ProposalCompletenessInput {
  proposal: ProposalDraft;
  relationships: KnowledgeRelationship[];
  documents: Document[];
}

/** Fields verified: `ProposalDraft.pricing_summary.subtotal_minor` (types/proposal.ts), `.status` (draft|accepted|rejected|superseded). Hero Image and Contract have no direct FK on Proposal — both are Knowledge Graph checks. */
export function evaluateProposalCompleteness(input: ProposalCompletenessInput): CompletenessResult {
  const node: KnowledgeNodeRef = { nodeType: "proposal", nodeId: input.proposal.id };
  const missingRequirements: string[] = [];

  if (!hasInboundRoleEdge(node, input.relationships, "hero_image")) missingRequirements.push("Missing Hero Image");
  if (relationshipCount(node, input.relationships, (r) => r.target_node_type === "proposal" && r.target_node_id === input.proposal.id && r.source_node_type === "contract") === 0) {
    missingRequirements.push("Missing Contract");
  }
  if (input.proposal.pricing_summary.subtotal_minor <= 0) missingRequirements.push("Missing Pricing");
  if (input.proposal.status !== "accepted") missingRequirements.push("Missing Approval");
  if (input.documents.length === 0) missingRequirements.push("Missing Attachments");

  return { missingRequirements, score: Math.round(((5 - missingRequirements.length) / 5) * 100) };
}

// ---------------------------------------------------------------------------
// Event Readiness
// ---------------------------------------------------------------------------

export interface EventCompletenessInput {
  event: Event;
  scheduleItems: EventScheduleItem[];
  vendorAssignments: EventServiceVendorAssignment[];
  checklistItems: ChecklistItem[];
  invoices: Invoice[];
  assets: MediaAsset[];
}

/** Fields verified: `Event.assigned_owner` (types/event.ts). Timeline = EventScheduleItem rows; Vendor = EventServiceVendorAssignment across the Event's own EventServices; Checklist = ChecklistItem rows; Payment = Invoice rows with this `event_id`; Assets = MediaAsset rows with `owner_type: "event"`. */
export function evaluateEventCompleteness(input: EventCompletenessInput): CompletenessResult {
  const missingRequirements: string[] = [];

  if (input.scheduleItems.length === 0) missingRequirements.push("Missing Timeline");
  if (input.vendorAssignments.length === 0) missingRequirements.push("Missing Vendor");
  if (input.checklistItems.length === 0) missingRequirements.push("Missing Checklist");
  if (input.invoices.length === 0) missingRequirements.push("Missing Payment");
  if (input.assets.length === 0) missingRequirements.push("Missing Assets");
  if (!input.event.assigned_owner) missingRequirements.push("Missing Team");

  return { missingRequirements, score: Math.round(((6 - missingRequirements.length) / 6) * 100) };
}

// ---------------------------------------------------------------------------
// Client Completeness
// ---------------------------------------------------------------------------

export interface ClientCompletenessInput {
  client: Client;
  contracts: Contract[];
  documents: Document[];
}

/**
 * Fields verified: `Client.email` (always a non-empty string, never checked
 * — schema already requires it), `.phone: string | null` (types/client.ts).
 * Signed Agreement = a Contract with `client_id` matching and
 * `signature_status === "signed"` (core/enums/signatureStatus.ts). Payment
 * Method has no field anywhere on Client, Contract, or Invoice — this
 * checkpoint doesn't invent one; see `notApplicableReason` at the
 * BusinessHealthEngine layer.
 */
export function evaluateClientCompleteness(input: ClientCompletenessInput): CompletenessResult {
  const missingRequirements: string[] = [];

  if (!input.client.phone) missingRequirements.push("Missing Contact Information");
  if (!input.contracts.some((c) => c.signature_status === "signed")) missingRequirements.push("Missing Signed Agreement");
  if (input.documents.length === 0) missingRequirements.push("Missing Documents");

  return { missingRequirements, score: Math.round(((3 - missingRequirements.length) / 3) * 100) };
}

// ---------------------------------------------------------------------------
// Vendor Readiness
// ---------------------------------------------------------------------------

export interface VendorCompletenessInput {
  vendor: Vendor;
}

/** Fields verified: `Vendor.status` ("active" | "inactive"), `.email`, `.phone` (types/vendor.ts). Vendor has no contracts/documents field of its own — a future step could check `Document`/`MediaAsset` with `owner_type: "vendor"`, not built here to keep this check honestly scoped to fields that actually exist on the type today. */
export function evaluateVendorCompleteness(input: VendorCompletenessInput): CompletenessResult {
  const missingRequirements: string[] = [];

  if (input.vendor.status !== "active") missingRequirements.push("Vendor Is Inactive");
  if (!input.vendor.email && !input.vendor.phone) missingRequirements.push("Missing Contact Information");

  return { missingRequirements, score: Math.round(((2 - missingRequirements.length) / 2) * 100) };
}
