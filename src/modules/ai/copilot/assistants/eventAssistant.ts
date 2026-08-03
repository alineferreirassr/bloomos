import { getEventById, listEventServicesByEvent, listEventServiceInventoryRequirements, getVendors, getWorkspaceMembers } from "@/lib/data";
import type { EventServiceInventoryRequirement } from "@/types/eventServiceInventoryRequirement";

export interface EventAssistantItem {
  itemName: string;
  quantity: number;
}

export interface EventAssistantVendorSuggestion {
  vendorId: string;
  companyName: string;
}

export interface EventAssistantTeamSuggestion {
  memberId: string;
  name: string;
}

export interface EventAssistant {
  /** Requirements already matched to a real Inventory item — pull these from stock, don't buy them. */
  packingList: EventAssistantItem[];
  /** Requirements with no matching Inventory item — these need to be purchased or sourced from a Vendor. */
  shoppingList: EventAssistantItem[];
  suggestedVendors: EventAssistantVendorSuggestion[];
  suggestedTeam: EventAssistantTeamSuggestion[];
  weatherReminder: string | null;
  luxuryTips: string[];
}

const LUXURY_TIPS = [
  "Confirm the final headcount with the client at least a week before the event.",
  "Walk the venue in person before the day-of, even if you've been there before.",
  "Keep a small emergency kit on-site — pins, tape, stain remover, and a sewing kit go a long way.",
  "Send a same-day thank-you note; it's the detail clients remember most.",
];

/**
 * Checkpoint 20, Step 14 — the Event Assistant. Timeline and Checklist are
 * already covered by the existing Event Operations Brief Skill
 * (`EventOperationsBriefSection.tsx`) — this generator adds the pieces that
 * Skill doesn't: a real Packing/Shopping List derived from
 * `EventServiceInventoryRequirement` rows (not fabricated), Suggested
 * Vendors/Team from real data, and two honestly-static pieces (Weather
 * Reminder, Luxury Tips) since no weather API or generative writing is in
 * scope this checkpoint.
 */
export async function generateEventAssistant(eventId: string): Promise<EventAssistant> {
  const [event, services, vendors, members] = await Promise.all([
    getEventById(eventId),
    listEventServicesByEvent(eventId),
    getVendors({ status: "active" }),
    getWorkspaceMembers(),
  ]);

  const requirementLists = await Promise.all(services.map((service) => listEventServiceInventoryRequirements(service.id)));
  const requirements: EventServiceInventoryRequirement[] = requirementLists.flat();
  const outstanding = requirements.filter((requirement) => !requirement.is_fulfilled);

  const packingList = outstanding
    .filter((requirement) => requirement.inventory_item_id !== null)
    .map((requirement) => ({ itemName: requirement.item_name, quantity: requirement.quantity }));

  const shoppingList = outstanding
    .filter((requirement) => requirement.inventory_item_id === null)
    .map((requirement) => ({ itemName: requirement.item_name, quantity: requirement.quantity }));

  const suggestedVendors = vendors
    .filter((vendor) => vendor.is_preferred)
    .slice(0, 3)
    .map((vendor) => ({ vendorId: vendor.id, companyName: vendor.company_name }));

  const suggestedTeam = members
    .filter((member) => member.full_name !== null && member.full_name !== event.assigned_owner)
    .slice(0, 3)
    .map((member) => ({ memberId: member.id, name: member.full_name as string }));

  const weatherReminder = event.event_date
    ? `Check the weather forecast for ${event.event_date} closer to the date — this workspace doesn't have a connected weather source yet.`
    : null;

  return { packingList, shoppingList, suggestedVendors, suggestedTeam, weatherReminder, luxuryTips: LUXURY_TIPS };
}
