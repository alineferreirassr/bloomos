import { getInvoices } from "@/lib/data";
import type { SuggestionProvider, CopilotSuggestion } from "@/core/ai/copilot/suggestionEngine";
import { formatMoney } from "@/lib/money";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Checkpoint 20, Step 7 — Finance suggestions: Invoice Reminder, Payment
 * Plan, Expense Review. `create-notification` only reaches an internal
 * Workspace member (see `crmSuggestions.ts`'s own note), so these stay
 * informational — a real "email the client an invoice reminder" action
 * doesn't exist in this codebase yet (no email/Twilio integration, and this
 * checkpoint's own stop condition forbids adding one).
 */
export const financeSuggestionProvider: SuggestionProvider = {
  module: "finance",
  async compute(): Promise<CopilotSuggestion[]> {
    const invoices = await getInvoices({ includeArchived: false });
    const now = Date.now();
    const suggestions: CopilotSuggestion[] = [];

    const overdue = invoices.filter((invoice) => invoice.status === "overdue");
    if (overdue.length > 0) {
      const totalMinor = overdue.reduce((sum, invoice) => sum + invoice.balance_minor, 0);
      suggestions.push({
        id: "finance-invoice-reminder",
        module: "finance",
        label: `Send reminders for ${overdue.length} overdue invoice${overdue.length === 1 ? "" : "s"}`,
        description: `${formatMoney(totalMinor, overdue[0]?.currency ?? "USD")} outstanding across overdue invoices.`,
        actionId: null,
        tone: "warning",
      });
    }

    const longOverdue = overdue.filter((invoice) => {
      if (!invoice.due_date) return false;
      return now - new Date(invoice.due_date).getTime() > THIRTY_DAYS_MS;
    });
    if (longOverdue.length > 0) {
      suggestions.push({
        id: "finance-payment-plan",
        module: "finance",
        label: `Offer a payment plan for ${longOverdue.length} invoice${longOverdue.length === 1 ? "" : "s"} over 30 days late`,
        description: "A structured plan often recovers balances a one-off reminder no longer moves.",
        actionId: null,
        tone: "warning",
      });
    }

    const partiallyPaid = invoices.filter((invoice) => invoice.status === "partially_paid");
    if (partiallyPaid.length > 0) {
      suggestions.push({
        id: "finance-expense-review",
        module: "finance",
        label: `Review ${partiallyPaid.length} partially paid invoice${partiallyPaid.length === 1 ? "" : "s"}`,
        description: "Confirm the remaining balance and expected settlement date for each.",
        actionId: null,
        tone: "info",
      });
    }

    return suggestions;
  },
};
