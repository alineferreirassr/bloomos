import { createInvoice } from "@/lib/data";
import type { AutomationActionDefinition, AutomationActionParams, AutomationActionResultDetail } from "@/types/automation";

export const CREATE_INVOICE_ACTION_ID = "create-invoice";

/**
 * v2.0 Checkpoint 39 — calls the same `createInvoice()` the Finance
 * module's own "New Invoice" form calls (`lib/data/index.ts`). Only
 * `client_id` and `title` are required by `invoiceSchema`; every money
 * field defaults to 0 (a draft with no line items yet, same starting shape
 * the manual "New Invoice" flow itself allows) rather than guessing an
 * amount from the trigger's own facts.
 *
 * Finance F2.1C-F-E-D-B1: createInvoice now requires a caller-generated
 * invoiceId. runAutomationAction (core/automation/actionRunner.ts) retries
 * a failed/thrown execute() call up to maxRetries additional times using
 * the SAME `params` object — but `AutomationActionParams` carries no field
 * that durably and uniquely identifies "this one trigger firing" versus a
 * later, unrelated firing of the same automation rule (`automationId`
 * identifies the rule, not a specific occurrence). Deriving a deterministic
 * id from the available fields (e.g. hashing facts) was considered and
 * rejected: two genuinely distinct real-world trigger events with
 * coincidentally identical facts would then collide and the second,
 * legitimate Invoice would be silently dropped as a "replay" of the first —
 * worse than today's behavior. With no stable durable execution id
 * available, and no invented one being safe, a fresh crypto.randomUUID()
 * per execute() call is used — this preserves today's existing behavior
 * exactly (a retried execution still creates its own Invoice) rather than
 * fabricating a false guarantee. See this file's own report disclosure:
 * AUTOMATION_CREATE_INVOICE_RETRY_IDEMPOTENCY = NOT GUARANTEED.
 */
const createInvoiceAction: AutomationActionDefinition = {
  id: CREATE_INVOICE_ACTION_ID,
  name: "Create Invoice",
  description: "Creates a new draft Invoice for a real Client.",
  category: "finance",
  version: "automation-action-create-invoice-v1",
  requiredPermissions: [],
  featureFlag: null,
  minimumRole: null,
  async execute(params: AutomationActionParams): Promise<AutomationActionResultDetail> {
    const clientId = params.facts.clientId;
    const title = params.facts.title;
    if (typeof clientId !== "string" || typeof title !== "string") {
      return { success: false, message: "Missing clientId or title in the trigger's own facts." };
    }
    const eventId = typeof params.facts.eventId === "string" ? params.facts.eventId : null;
    const subtotalMinor = typeof params.facts.subtotalMinor === "number" ? params.facts.subtotalMinor : 0;

    const result = await createInvoice(
      {
        client_id: clientId,
        event_id: eventId,
        contract_id: null,
        title,
        description: null,
        issue_date: null,
        due_date: null,
        subtotal_minor: subtotalMinor,
        tax_minor: 0,
        discount_minor: 0,
        currency: "USD",
        notes: null,
      },
      crypto.randomUUID(),
    );
    if (!result.success) return { success: false, message: result.error };
    return { success: true, message: `Invoice "${result.data.title}" created.`, resultRef: { type: "invoice", id: result.data.id } };
  },
};

export default createInvoiceAction;
