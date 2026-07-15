/**
 * Curated categories for a reusable ContractTemplate — deliberately
 * workspace-agnostic (no Amoré-Bloom-specific category), since templates
 * must be reusable across every Workspace, not just this one.
 */
export const CONTRACT_TEMPLATE_CATEGORIES = [
  "event_agreement",
  "vendor_agreement",
  "rental_agreement",
  "photography_release",
  "venue_rental",
  "custom",
  "other",
] as const;

export type ContractTemplateCategory = (typeof CONTRACT_TEMPLATE_CATEGORIES)[number];

export const CONTRACT_TEMPLATE_CATEGORY_LABELS: Record<ContractTemplateCategory, string> = {
  event_agreement: "Event Agreement",
  vendor_agreement: "Vendor Agreement",
  rental_agreement: "Rental Agreement",
  photography_release: "Photography Release",
  venue_rental: "Venue Rental",
  custom: "Custom",
  other: "Other",
};
