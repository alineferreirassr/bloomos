import type { DailyBriefActionTarget, DailyBriefActionTargetType } from "@/modules/ai/dailyBrief/types";

/**
 * The only place a `DailyBriefActionTarget`'s `href` is ever constructed —
 * same architectural guarantee as `modules/ai/actionTargets.ts`: the model
 * only ever chooses a closed `DailyBriefActionTargetType` enum value (never
 * a raw URL), and this function is the sole translator from that enum to a
 * real, already-existing BloomOS route.
 */
export function resolveDailyBriefActionTarget(type: DailyBriefActionTargetType | null, targetId: string | null): DailyBriefActionTarget | null {
  if (type === null || targetId === null) return null;
  switch (type) {
    case "event":
      return { type: "event", href: `/events/${targetId}`, label: "Open Event" };
    case "invoice":
      return { type: "invoice", href: `/finance/invoices/${targetId}`, label: "Open Invoice" };
    case "contract":
      return { type: "contract", href: `/contracts/${targetId}`, label: "Open Contract" };
    default:
      return null;
  }
}
