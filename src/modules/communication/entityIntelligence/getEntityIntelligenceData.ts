"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getClientById, getEventById, getLeadById, getVendorById, getInvoiceById } from "@/lib/data";
import { getProposalsRepository } from "@/lib/data/proposals";
import { getCoreCommentsService } from "@/core/comments";
import { registerBuiltinActivitySources } from "@/modules/communication/activityAdapters";
import { aggregateActivity } from "@/core/communication/activityAggregator";
import { mockReminderRepository } from "@/lib/data/core/communication/reminderStore";
import { getOperationsDashboardData } from "@/modules/operations/operationsDashboardData";
import type { EntityIntelligenceSnapshot } from "@/types/communication";
import type { EntityType } from "@/core/enums/entityType";
import { getFullName } from "@/lib/personName";
import { formatMoney } from "@/lib/money";
import { clockNow } from "@/core/time/clock";

const GENERIC_ACCESS_ERROR = "This record isn't available. You may not have access to it.";
const RECENT_CHANGE_WINDOW_DAYS = 7;

/** Mirrors `core/operations/healthScoreEngine.ts`'s own (unexported) `bandFromScore` — the score this reuses is that engine's own output, so the bands must match exactly rather than reusing Checkpoint 23's differently-thresholded Business Health bands. */
function operationsBandFromScore(score: number): EntityIntelligenceSnapshot["riskBand"] {
  if (score >= 90) return "excellent";
  if (score >= 70) return "good";
  if (score >= 45) return "attention";
  return "critical";
}

async function resolveTitleAndSubtitle(ownerType: EntityType, ownerId: string): Promise<{ title: string; subtitle: string | null }> {
  try {
    switch (ownerType) {
      case "client": {
        const client = await getClientById(ownerId);
        return { title: getFullName(client), subtitle: client.email };
      }
      case "lead": {
        const lead = await getLeadById(ownerId);
        return { title: getFullName(lead), subtitle: lead.status };
      }
      case "event": {
        const event = await getEventById(ownerId);
        return { title: event.title, subtitle: event.event_date };
      }
      case "vendor": {
        const vendor = await getVendorById(ownerId);
        return { title: vendor.display_name ?? vendor.company_name, subtitle: vendor.contact_person };
      }
      case "invoice": {
        const invoice = await getInvoiceById(ownerId);
        return { title: `Invoice ${invoice.invoice_number}`, subtitle: formatMoney(invoice.total_minor, invoice.currency) };
      }
      case "proposal": {
        const proposal = await getProposalsRepository().getProposalById(ownerId);
        return { title: proposal ? "Proposal" : "Proposal (not found)", subtitle: proposal?.status ?? null };
      }
      default:
        return { title: ownerType, subtitle: null };
    }
  } catch {
    return { title: ownerType, subtitle: null };
  }
}

/**
 * v2.0 Checkpoint 24, Step 15 — Entity Intelligence. Composes existing
 * per-module getters (never re-derives their data), the Communication
 * Timeline (Step 7.5's own `aggregateActivity`), Comments, Reminders, and —
 * only for the entity types that already have one — Checkpoint 21's
 * per-event Health Score. `riskScore`/`riskBand` are `null` for every
 * entity type without an existing health-scoring engine (Client, Lead,
 * Vendor, Invoice, Proposal) rather than a fabricated number — see
 * `docs/entity-intelligence.md`'s Known Limitations.
 */
export async function getEntityIntelligenceData(ownerType: EntityType, ownerId: string): Promise<{ success: true; data: EntityIntelligenceSnapshot } | { success: false; error: string }> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };

  registerBuiltinActivitySources();
  const now = clockNow();

  const [{ title, subtitle }, timeline, comments, reminders, operationsData] = await Promise.all([
    resolveTitleAndSubtitle(ownerType, ownerId),
    aggregateActivity({ workspaceId: session.workspace.id, ownerType, ownerId }),
    getCoreCommentsService().getCommentsForOwner(session.workspace.id, ownerType, ownerId),
    mockReminderRepository.listRemindersForOwner(session.workspace.id, ownerType, ownerId),
    ownerType === "event" ? getOperationsDashboardData() : Promise.resolve(null),
  ]);

  let riskScore: number | null = null;
  if (ownerType === "event" && operationsData) {
    const match = operationsData.eventHealthScores.find((entry) => entry.event.id === ownerId);
    riskScore = match?.score ?? null;
  }

  const recentChangeCutoff = new Date(now.getTime() - RECENT_CHANGE_WINDOW_DAYS * 24 * 3_600_000).toISOString();

  return {
    success: true,
    data: {
      ownerType,
      ownerId,
      title,
      subtitle,
      timeline,
      commentCount: comments.length,
      riskScore,
      riskBand: riskScore === null ? null : operationsBandFromScore(riskScore),
      relationshipScore: null,
      upcomingActionCount: reminders.filter((r) => r.status === "pending").length,
      recentChangeCount: timeline.filter((entry) => entry.occurredAt >= recentChangeCutoff).length,
      generatedAt: now.toISOString(),
    },
  };
}

