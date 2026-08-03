"use server";

import { getCurrentClientAccountContext, getClientPortalEventById, getClientPortalContracts, getClientPortalInvoices, getClientPortalDocuments } from "@/lib/data";
import { listClientPortalProposalsAction } from "@/modules/clientPortal/getClientPortalProposal";
import { getCoreKnowledgeGraphService } from "@/core/knowledge";
import { RELATIONSHIP_TYPE_LABELS, type KnowledgeNodeType, type KnowledgeRelationship } from "@/types/knowledgeGraph";
import { NotFoundError } from "@/core/errors";

const GENERIC_ACCESS_ERROR = "Connections aren't available for this event. Please sign in again.";

type ClientSafeNodeType = "proposal" | "contract" | "invoice" | "document";

const CLIENT_SAFE_NODE_TYPES: readonly ClientSafeNodeType[] = ["proposal", "contract", "invoice", "document"];

function isClientSafeNodeType(nodeType: KnowledgeNodeType): nodeType is ClientSafeNodeType {
  return (CLIENT_SAFE_NODE_TYPES as readonly string[]).includes(nodeType);
}

export interface ClientPortalKnowledgeConnection {
  nodeType: ClientSafeNodeType;
  nodeId: string;
  label: string;
  relationshipLabel: string;
  href: string;
}

export interface ClientPortalKnowledgeSummary {
  connections: ClientPortalKnowledgeConnection[];
}

type Result<T> = { success: true; data: T } | { success: false; error: string };

function hrefFor(nodeType: ClientSafeNodeType, nodeId: string): string {
  switch (nodeType) {
    case "contract":
      return `/client-access/contracts/${nodeId}`;
    case "invoice":
      return `/client-access/invoices/${nodeId}`;
    case "document":
      return `/client-access/documents/${nodeId}`;
    case "proposal":
      return `/client-access/proposals/${nodeId}`;
  }
}

/**
 * Checkpoint 36, Step 14 — Knowledge Graph aggregation for the Client
 * Portal. Every internal platform (Proposal/Contract/Invoice) already
 * writes real relationships into the Knowledge Graph
 * (`getCoreKnowledgeGraphService().createRelationship`) when those
 * entities are created — this reads that same graph back for the client's
 * own event, translating raw edges into plain language, rather than
 * inventing a second "how things connect" computation. Internal-only node
 * types (comment, message, reminder, workflow, ai_insight, media_folder,
 * template/clause library entities, etc.) are filtered out entirely —
 * `CLIENT_SAFE_NODE_TYPES` is a strict allowlist, not a denylist, so a
 * future node type is excluded by default until explicitly reviewed.
 * Titles are resolved by cross-referencing the exact same client-safe
 * accessors the Proposal/Contract/Billing/Document Centers already use
 * (never a new, unscoped repository lookup) — a relationship pointing at
 * a record absent from that list (a data inconsistency, or a graph edge
 * that predates this client's own account) is silently skipped rather
 * than surfaced with a guessed label.
 */
export async function getClientPortalKnowledgeSummaryAction(eventId: string): Promise<Result<ClientPortalKnowledgeSummary>> {
  const context = await getCurrentClientAccountContext();
  if (!context) return { success: false, error: GENERIC_ACCESS_ERROR };

  try {
    await getClientPortalEventById(eventId);
  } catch (err) {
    if (err instanceof NotFoundError) return { success: false, error: GENERIC_ACCESS_ERROR };
    throw err;
  }

  const eventNode = { nodeType: "event" as const, nodeId: eventId };
  const knowledgeGraph = getCoreKnowledgeGraphService();
  const [outbound, inbound, contracts, proposalsResult, invoices, documents] = await Promise.all([
    knowledgeGraph.getOutboundRelationships(context.account.workspace_id, eventNode),
    knowledgeGraph.getInboundRelationships(context.account.workspace_id, eventNode),
    getClientPortalContracts(),
    listClientPortalProposalsAction(),
    getClientPortalInvoices(),
    getClientPortalDocuments(),
  ]);
  const proposals = proposalsResult.success ? proposalsResult.data : [];

  function titleFor(nodeType: ClientSafeNodeType, nodeId: string): string | null {
    switch (nodeType) {
      case "contract":
        return contracts.find((c) => c.id === nodeId)?.title ?? null;
      case "invoice": {
        const invoice = invoices.find((i) => i.id === nodeId);
        return invoice ? `Invoice ${invoice.invoice_number}` : null;
      }
      case "document":
        return documents.find((d) => d.id === nodeId)?.title ?? null;
      case "proposal":
        return proposals.find((p) => p.proposalId === nodeId)?.title ?? null;
    }
  }

  const relationships: KnowledgeRelationship[] = [...outbound, ...inbound].filter((relationship) => relationship.status === "active");
  const connections: ClientPortalKnowledgeConnection[] = [];
  const seen = new Set<string>();

  for (const relationship of relationships) {
    const isSourceEvent = relationship.source_node_type === "event" && relationship.source_node_id === eventId;
    const otherType = isSourceEvent ? relationship.target_node_type : relationship.source_node_type;
    const otherId = isSourceEvent ? relationship.target_node_id : relationship.source_node_id;
    if (!isClientSafeNodeType(otherType)) continue;

    const key = `${otherType}:${otherId}`;
    if (seen.has(key)) continue;

    const label = titleFor(otherType, otherId);
    if (!label) continue;

    seen.add(key);
    connections.push({ nodeType: otherType, nodeId: otherId, label, relationshipLabel: RELATIONSHIP_TYPE_LABELS[relationship.relationship_type], href: hrefFor(otherType, otherId) });
  }

  return { success: true, data: { connections } };
}
