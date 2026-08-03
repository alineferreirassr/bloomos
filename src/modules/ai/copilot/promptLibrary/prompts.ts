/** Checkpoint 20, Step 15 — the Prompt Library's static catalog. Every prompt is a starting point a person edits before running through the Writing Studio or a Skill — none of these execute themselves. */
export const PROMPT_CATEGORIES = ["crm", "finance", "events", "inventory", "documents", "marketing", "client_care", "operations"] as const;
export type PromptCategory = (typeof PROMPT_CATEGORIES)[number];

export const PROMPT_CATEGORY_LABELS: Record<PromptCategory, string> = {
  crm: "CRM",
  finance: "Finance",
  events: "Events",
  inventory: "Inventory",
  documents: "Documents",
  marketing: "Marketing",
  client_care: "Client Care",
  operations: "Operations",
};

export interface PromptTemplate {
  id: string;
  category: PromptCategory;
  title: string;
  template: string;
}

export const PROMPT_LIBRARY: PromptTemplate[] = [
  { id: "crm-follow-up", category: "crm", title: "Follow-up message", template: "Write a warm follow-up to a lead who hasn't responded in a week." },
  { id: "crm-vip-checkin", category: "crm", title: "VIP client check-in", template: "Draft a check-in message for a VIP client ahead of their event." },
  { id: "finance-invoice-reminder", category: "finance", title: "Invoice reminder", template: "Write a polite reminder for an overdue invoice." },
  { id: "finance-payment-plan", category: "finance", title: "Payment plan offer", template: "Offer a client a structured payment plan for their remaining balance." },
  { id: "events-day-of-timeline", category: "events", title: "Day-of timeline", template: "Summarize the day-of timeline for an upcoming event in a few sentences." },
  { id: "events-vendor-brief", category: "events", title: "Vendor brief", template: "Write a short brief for a vendor about an upcoming event's requirements." },
  { id: "inventory-restock-note", category: "inventory", title: "Restock note", template: "Write an internal note flagging an item that needs restocking soon." },
  { id: "inventory-purchase-request", category: "inventory", title: "Purchase request", template: "Draft a purchase request summary for a vendor order." },
  { id: "documents-cover-note", category: "documents", title: "Document cover note", template: "Write a short cover note to accompany a document sent to a client." },
  { id: "documents-summary", category: "documents", title: "Document summary", template: "Summarize the key points of a document in three sentences." },
  { id: "marketing-social-caption", category: "marketing", title: "Social caption", template: "Write a short, elegant social caption celebrating a recent event." },
  { id: "marketing-newsletter-blurb", category: "marketing", title: "Newsletter blurb", template: "Write a newsletter blurb introducing a new service offering." },
  { id: "client-care-welcome", category: "client_care", title: "Welcome message", template: "Write a warm welcome message for a newly signed client." },
  { id: "client-care-thank-you", category: "client_care", title: "Thank-you note", template: "Write a heartfelt thank-you note after a successful event." },
  { id: "operations-team-update", category: "operations", title: "Team update", template: "Write a short update for the team about this week's priorities." },
  { id: "operations-handoff-note", category: "operations", title: "Handoff note", template: "Write a handoff note summarizing an event's status for a teammate." },
];
