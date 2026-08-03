import type { AIActionTarget } from "@/modules/ai/types";

export type ActionTargetType = "checklist" | "schedule" | "event";

/**
 * The only place an `AIActionTarget`'s `href` is ever constructed — the
 * model only ever chooses a closed `ActionTargetType` enum value (never a
 * raw URL or href string), and this function is the sole translator from
 * that enum to a real, already-existing BloomOS route. This is what makes
 * "no arbitrary URL" an architectural guarantee rather than a prompt-only
 * instruction: even a fully adversarial or malfunctioning provider response
 * can only ever select among these three fixed, hardcoded destinations.
 *
 * Extension point: once a genuine Vendor/Purchases/Inventory/Finance link
 * exists on Event (none does today — confirmed during discovery), add a
 * case here and to `ActionTargetType`/the model-output enum together;
 * nothing else needs to change.
 */
export function resolveActionTarget(type: ActionTargetType | null, eventId: string): AIActionTarget | null {
  switch (type) {
    case "checklist":
      return { type: "checklist", href: `/events/${eventId}/checklist`, label: "Open Checklist" };
    case "schedule":
      return { type: "schedule", href: `/events/${eventId}/schedule`, label: "Open Schedule" };
    case "event":
      return { type: "event", href: `/events/${eventId}`, label: "Open Event" };
    case null:
      return null;
    default:
      return null;
  }
}
