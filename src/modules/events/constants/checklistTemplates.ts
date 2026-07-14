import type { ChecklistItemInput } from "@/modules/checklist/schema";
import type { EventType } from "@/core/enums/eventType";

/**
 * Reusable constants, not UI. createEvent() (lib/data/index.ts) reads from
 * DEFAULT_CHECKLIST_TEMPLATES to auto-populate a new Event's checklist based
 * on its event_type, then the user edits from there — no component ever
 * constructs a checklist item by hand for this purpose.
 *
 * due_date is left null on every template item: a template has no concrete
 * event date to compute a due date relative to. assigned_type defaults to
 * "unknown" (no Employee/Vendor module exists yet) — the user assigns later.
 */
function item(
  title: string,
  category: ChecklistItemInput["category"],
  priority: ChecklistItemInput["priority"],
): ChecklistItemInput {
  return {
    title,
    description: null,
    category,
    priority,
    due_date: null,
    assigned_type: "unknown",
    assigned_id: null,
    assigned_name: null,
  };
}

export const defaultProposalChecklist: ChecklistItemInput[] = [
  item("Confirm ring", "client", "critical"),
  item("Confirm flowers", "flowers", "high"),
  item("Prepare champagne", "food_beverage", "normal"),
  item("Charge speakers", "setup", "normal"),
  item("Print custom sign", "decor", "normal"),
  item("Check weather", "weather", "high"),
  item("Backup location", "weather", "normal"),
  item("Photography ready", "photography", "high"),
  item("Lighting", "setup", "normal"),
  item("Transportation", "transportation", "normal"),
  item("Cleanup", "cleanup", "normal"),
];

export const defaultPicnicChecklist: ChecklistItemInput[] = [
  item("Confirm picnic location permit", "venue", "high"),
  item("Order picnic setup (blanket, pillows, low table)", "decor", "normal"),
  item("Prepare charcuterie / food spread", "food_beverage", "normal"),
  item("Confirm weather backup plan", "weather", "high"),
  item("Pack cooler and drinks", "food_beverage", "normal"),
  item("Bring portable speaker", "setup", "low"),
  item("Arrange florals / centerpiece", "flowers", "normal"),
  item("Schedule photography", "photography", "normal"),
  item("Pack trash / cleanup bags", "cleanup", "low"),
  item("Confirm guest count", "client", "normal"),
  item("Arrange transportation of setup items", "transportation", "normal"),
];

export const defaultHotelDecorationChecklist: ChecklistItemInput[] = [
  item("Confirm hotel key / room access", "venue", "critical"),
  item("Coordinate arrival window with front desk", "venue", "high"),
  item("Order balloons / decor per palette", "decor", "normal"),
  item("Arrange rose petals", "decor", "normal"),
  item("Prepare champagne and glasses", "food_beverage", "normal"),
  item("Order dessert / charcuterie", "food_beverage", "normal"),
  item("Set up lighting (candles, LED)", "setup", "normal"),
  item("Print signage / message cards", "decor", "low"),
  item("Confirm nut / allergy-safe food", "food_beverage", "critical"),
  item("Photograph the final setup", "photography", "normal"),
  item("Plan discreet cleanup / exit", "cleanup", "normal"),
];

export const defaultAnniversaryChecklist: ChecklistItemInput[] = [
  item("Confirm venue reservation", "venue", "high"),
  item("Send deposit invoice", "finance", "high"),
  item("Confirm dietary restrictions with caterer", "food_beverage", "high"),
  item("Order florals matching palette", "flowers", "normal"),
  item("Arrange live music / playlist", "setup", "normal"),
  item("Confirm confidentiality plan (if surprise)", "client", "high"),
  item("Print menu cards", "decor", "low"),
  item("Coordinate photography", "photography", "normal"),
  item("Prepare toast / speech cue cards", "planning", "low"),
  item("Arrange transportation", "transportation", "normal"),
  item("Send post-event thank-you follow-up", "post_event", "normal"),
];

/**
 * Only event types with a defined luxury-event checklist appear here.
 * Types without an entry (e.g. birthday, romantic_setup, other) get no
 * auto-populated checklist — createEvent() treats a missing entry as "no
 * default", not an error.
 */
export const DEFAULT_CHECKLIST_TEMPLATES: Partial<Record<EventType, ChecklistItemInput[]>> = {
  proposal: defaultProposalChecklist,
  picnic: defaultPicnicChecklist,
  hotel_decoration: defaultHotelDecorationChecklist,
  anniversary: defaultAnniversaryChecklist,
};
