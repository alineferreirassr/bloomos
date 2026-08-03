import type { CrmActionTargetType, CrmAssistantActionTarget } from "@/modules/ai/crmAssistant/types";

/**
 * The only place a `CrmAssistantActionTarget`'s `href` is ever constructed
 * — same architectural guarantee as `modules/ai/dailyBrief/actionTargets.ts`:
 * the model only ever chooses a closed `CrmActionTargetType` enum value
 * (never a raw URL), and this function is the sole translator from that
 * enum to a real, already-existing BloomOS route.
 */
export function resolveCrmAssistantActionTarget(type: CrmActionTargetType | null, targetId: string | null): CrmAssistantActionTarget | null {
  if (type === null || targetId === null) return null;
  switch (type) {
    case "client":
      return { type: "client", href: `/clients/${targetId}`, label: "Open Client" };
    case "lead":
      return { type: "lead", href: `/leads/${targetId}`, label: "Open Lead" };
    case "event":
      return { type: "event", href: `/events/${targetId}`, label: "Open Event" };
    case "contract":
      return { type: "contract", href: `/contracts/${targetId}`, label: "Open Contract" };
    case "invoice":
      return { type: "invoice", href: `/finance/invoices/${targetId}`, label: "Open Invoice" };
    default:
      return null;
  }
}
