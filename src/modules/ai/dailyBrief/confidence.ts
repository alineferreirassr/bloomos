import type { DailyOperationsBriefContext } from "@/modules/ai/dailyBrief/types";

const DATA_CATEGORY_LABELS: Record<string, string> = {
  events: "Events",
  finance: "Late payments",
  contracts: "Unsigned contracts",
  clients: "High-priority clients",
  notifications: "Notifications",
  activity: "Recent activity",
};

const TOTAL_CATEGORIES = Object.keys(DATA_CATEGORY_LABELS).length;

/**
 * Confidence here reflects how much of BloomOS's own operational surface
 * was successfully *read*, not whether each surface has entries — a
 * Workspace with zero late payments and zero unsigned contracts is doing
 * well, not "low confidence." Each of `fetchDailyOperationsBriefMaterials`'s
 * 6 independently-fetched categories that came back genuinely
 * unavailable (a fetch failure, not a real empty result) both deducts an
 * equal share of 100 and is named in the reason — the same "trace low
 * confidence to a real, absent read, never a model's self-assessment"
 * principle `modules/ai/confidence.ts` already established for one Event.
 */
export function computeDailyBriefConfidence(context: DailyOperationsBriefContext): { score: number; reason: string } {
  const unavailable = context.unavailableCategories;
  const score = Math.round(Math.min(100, ((TOTAL_CATEGORIES - unavailable.length) / TOTAL_CATEGORIES) * 100));

  const reason =
    unavailable.length === 0
      ? "Every data category was read successfully."
      : `Could not read: ${unavailable.map((key) => DATA_CATEGORY_LABELS[key] ?? key).join(", ")}.`;

  return { score, reason };
}

/**
 * "Missing information" for the Daily Brief is exclusively about read
 * failures — a genuinely empty category (e.g. zero late payments) is a
 * real, good data point, never listed here as if something were missing.
 */
export function computeDailyBriefMissingInformation(context: DailyOperationsBriefContext): string[] {
  return context.unavailableCategories.map((key) => `${DATA_CATEGORY_LABELS[key] ?? key} could not be read this time.`);
}
