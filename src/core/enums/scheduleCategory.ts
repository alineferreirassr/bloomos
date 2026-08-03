export const SCHEDULE_CATEGORIES = [
  "arrival",
  "delivery",
  "setup",
  "vendor",
  "client",
  "surprise",
  "ceremony",
  "photography",
  "video",
  "food_beverage",
  "cleanup",
  "departure",
  "other",
] as const;

export type ScheduleCategory = (typeof SCHEDULE_CATEGORIES)[number];

export const SCHEDULE_CATEGORY_LABELS: Record<ScheduleCategory, string> = {
  arrival: "Arrival",
  delivery: "Delivery",
  setup: "Setup",
  vendor: "Vendor",
  client: "Client",
  surprise: "Surprise",
  ceremony: "Ceremony",
  photography: "Photography",
  video: "Video",
  food_beverage: "Food & Beverage",
  cleanup: "Cleanup",
  departure: "Departure",
  other: "Other",
};
