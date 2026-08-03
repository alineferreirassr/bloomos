import { archiveLead, archiveClient, archiveEvent, archiveContract, archiveInvoice, archiveExpense, archiveDocument, archiveVendor, archivePurchase } from "@/lib/data";
import type { DataResult } from "@/lib/data/result";
import type { EntityType } from "@/core/enums/entityType";
import type { AutomationActionDefinition, AutomationActionParams, AutomationActionResultDetail } from "@/types/automation";

export const ARCHIVE_ENTITY_ACTION_ID = "archive-entity";

/**
 * v2.0 Checkpoint 39 — a curated dispatch table over real, already-working
 * per-entity archivers (`lib/data/index.ts`), not a fabricated universal
 * archiver. Only entity types with a real `archiveX()` function are listed
 * here; a Workflow author picking anything else gets an honest error
 * naming exactly which entity types are actually supported.
 */
const ARCHIVERS: Partial<Record<EntityType, (id: string) => Promise<DataResult<{ id: string }>>>> = {
  lead: archiveLead,
  client: archiveClient,
  event: archiveEvent,
  contract: archiveContract,
  invoice: archiveInvoice,
  expense: archiveExpense,
  document: archiveDocument,
  vendor: archiveVendor,
  purchase: archivePurchase,
};

const archiveEntityAction: AutomationActionDefinition = {
  id: ARCHIVE_ENTITY_ACTION_ID,
  name: "Archive Entity",
  description: "Archives a real Lead, Client, Event, Contract, Invoice, Expense, Document, Vendor, or Purchase.",
  category: "general",
  version: "automation-action-archive-entity-v1",
  requiredPermissions: [],
  featureFlag: null,
  minimumRole: null,
  async execute(params: AutomationActionParams): Promise<AutomationActionResultDetail> {
    const entityType = params.facts.entityType;
    const entityId = params.facts.entityId;
    if (typeof entityType !== "string" || typeof entityId !== "string") {
      return { success: false, message: "Missing entityType or entityId in the trigger's own facts." };
    }
    const archiver = ARCHIVERS[entityType as EntityType];
    if (!archiver) {
      return { success: false, message: `"${entityType}" can't be archived by this Action — supported types: ${Object.keys(ARCHIVERS).join(", ")}.` };
    }

    const result = await archiver(entityId);
    if (!result.success) return { success: false, message: result.error };
    return { success: true, message: `${entityType} archived.`, resultRef: { type: entityType as EntityType, id: result.data.id } };
  },
};

export default archiveEntityAction;
