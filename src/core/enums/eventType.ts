export const EVENT_TYPES = [
  "proposal",
  "anniversary",
  "birthday",
  "picnic",
  "hotel_decoration",
  "romantic_setup",
  "private_dinner",
  "engagement",
  "micro_wedding",
  "bridal_shower",
  "baby_shower",
  "elopement",
  "styled_shoot",
  "branding",
  "photoshoot",
  "other",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  proposal: "Proposal",
  anniversary: "Anniversary",
  birthday: "Birthday",
  picnic: "Picnic",
  hotel_decoration: "Hotel Decoration",
  romantic_setup: "Romantic Setup",
  private_dinner: "Private Dinner",
  engagement: "Engagement",
  micro_wedding: "Micro Wedding",
  bridal_shower: "Bridal Shower",
  baby_shower: "Baby Shower",
  elopement: "Elopement",
  styled_shoot: "Styled Shoot",
  branding: "Branding",
  photoshoot: "Photoshoot",
  other: "Other",
};
