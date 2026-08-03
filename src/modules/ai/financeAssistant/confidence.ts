import type { FinanceAssistantContext } from "@/modules/ai/financeAssistant/types";

const DATA_CATEGORY_LABELS: Record<string, string> = {
  invoices: "Invoices",
  payments: "Payments",
  contracts: "Contracts",
  expenses: "Expenses",
  proposals: "Proposal values",
  events: "Events",
  dailyBriefs: "Daily Brief history",
  activity: "Recent activity",
};

const TOTAL_CATEGORIES = Object.keys(DATA_CATEGORY_LABELS).length;

/**
 * Confidence reflects how much of BloomOS's own financial surface was
 * successfully *read*, never whether each surface has entries — a
 * Workspace with zero overdue Invoices is doing well, not "low
 * confidence." Mirrors `crmAssistant/confidence.ts`'s exact same principle.
 */
export function computeFinanceAssistantConfidence(context: FinanceAssistantContext): { score: number; reason: string } {
  const unavailable = context.unavailableCategories;
  const score = Math.round(Math.min(100, ((TOTAL_CATEGORIES - unavailable.length) / TOTAL_CATEGORIES) * 100));

  const reason =
    unavailable.length === 0
      ? "Every data category was read successfully."
      : `Could not read: ${unavailable.map((key) => DATA_CATEGORY_LABELS[key] ?? key).join(", ")}.`;

  return { score, reason };
}

/** "Missing information" is exclusively about read failures — a genuinely empty category is a real, good data point, never listed here. */
export function computeFinanceAssistantMissingInformation(context: FinanceAssistantContext): string[] {
  return context.unavailableCategories.map((key) => `${DATA_CATEGORY_LABELS[key] ?? key} could not be read this time.`);
}
