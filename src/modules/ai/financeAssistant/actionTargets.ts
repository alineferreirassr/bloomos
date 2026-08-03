import type { FinanceActionTargetType, FinanceAssistantActionTarget } from "@/modules/ai/financeAssistant/types";

/**
 * The only place a `FinanceAssistantActionTarget`'s `href` is ever
 * constructed — same architectural guarantee as
 * `modules/ai/crmAssistant/actionTargets.ts`: the model only ever chooses a
 * closed `FinanceActionTargetType` enum value (never a raw URL), and this
 * function is the sole translator from that enum to a real, already-
 * existing BloomOS route.
 */
export function resolveFinanceAssistantActionTarget(type: FinanceActionTargetType | null, targetId: string | null): FinanceAssistantActionTarget | null {
  if (type === null || targetId === null) return null;
  switch (type) {
    case "invoice":
      return { type: "invoice", href: `/finance/invoices/${targetId}`, label: "Open Invoice" };
    case "contract":
      return { type: "contract", href: `/contracts/${targetId}`, label: "Open Contract" };
    case "event":
      return { type: "event", href: `/events/${targetId}`, label: "Open Event" };
    default:
      return null;
  }
}
