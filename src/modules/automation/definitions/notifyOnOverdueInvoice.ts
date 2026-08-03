import { CREATE_NOTIFICATION_ACTION_ID } from "@/modules/automation/actions/createNotificationAction";
import type { AutomationDefinition } from "@/types/automation";

export const NOTIFY_ON_OVERDUE_INVOICE_ID = "notify-on-overdue-invoice";

/**
 * Example Automation #1 — `workspace_configurable` approval. Registered
 * and fully tested (`resolver.test.ts` exercises it via a direct
 * `executeAutomation()` call, including the workspace-override mechanism),
 * but no real domain mutation dispatches `invoice.overdue` this checkpoint
 * (that would mean touching Finance's own overdue-detection sweep, out of
 * scope for a checkpoint about the Engine itself — see
 * `docs/automation-engine.md`'s "Known limitations").
 */
const notifyOnOverdueInvoice: AutomationDefinition = {
  id: NOTIFY_ON_OVERDUE_INVOICE_ID,
  name: "Notify on Overdue Invoice",
  description: "Notifies a Workspace member when an Invoice has been overdue for at least a week.",
  category: "finance",
  version: "automation-def-notify-overdue-invoice-v1",
  status: "active",
  trigger: "invoice.overdue",
  conditions: [{ field: "daysOverdue", operator: "gte", value: 7 }],
  actionIds: [CREATE_NOTIFICATION_ACTION_ID],
  approvalPolicy: { kind: "workspace_configurable" },
  requiredPermissions: [],
  featureFlag: null,
  minimumRole: null,
  maxRetries: 1,
};

export default notifyOnOverdueInvoice;
