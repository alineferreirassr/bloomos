import { duplicateContract, duplicateInvoice, duplicateExpense } from "@/lib/data";
import type { DataResult } from "@/lib/data/result";
import type { EntityType } from "@/core/enums/entityType";
import type { AutomationActionDefinition, AutomationActionParams, AutomationActionResultDetail } from "@/types/automation";

export const DUPLICATE_ENTITY_ACTION_ID = "duplicate-entity";

/**
 * v2.0 Checkpoint 39 — the same curated-dispatch-table pattern as
 * `archive-entity`. Only Contract, Invoice, and Expense have a real
 * `duplicateX()` function in `lib/data/index.ts` — no other entity type
 * supports duplication yet, so this Action honestly only offers those
 * three rather than claiming universal support.
 */
const DUPLICATORS: Partial<Record<EntityType, (id: string) => Promise<DataResult<{ id: string }>>>> = {
  contract: duplicateContract,
  invoice: duplicateInvoice,
  expense: duplicateExpense,
};

const duplicateEntityAction: AutomationActionDefinition = {
  id: DUPLICATE_ENTITY_ACTION_ID,
  name: "Duplicate Entity",
  description: "Duplicates a real Contract, Invoice, or Expense.",
  category: "general",
  version: "automation-action-duplicate-entity-v1",
  requiredPermissions: [],
  featureFlag: null,
  minimumRole: null,
  async execute(params: AutomationActionParams): Promise<AutomationActionResultDetail> {
    const entityType = params.facts.entityType;
    const entityId = params.facts.entityId;
    if (typeof entityType !== "string" || typeof entityId !== "string") {
      return { success: false, message: "Missing entityType or entityId in the trigger's own facts." };
    }
    const duplicator = DUPLICATORS[entityType as EntityType];
    if (!duplicator) {
      return { success: false, message: `"${entityType}" can't be duplicated by this Action — supported types: ${Object.keys(DUPLICATORS).join(", ")}.` };
    }

    const result = await duplicator(entityId);
    if (!result.success) return { success: false, message: result.error };
    return { success: true, message: `${entityType} duplicated.`, resultRef: { type: entityType as EntityType, id: result.data.id } };
  },
};

export default duplicateEntityAction;
