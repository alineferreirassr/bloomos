import type { SettingRecommendation, SettingValue } from "@/types/settings";

/**
 * Step 16's own "Bloom AI may recommend configuration changes. It must
 * NEVER apply them automatically." A rule is a pure function over a
 * Setting's own current resolved value — deterministic, the same
 * "a rule over real state, never a generative call" precedent
 * `modules/workflow/getWorkflowSuggestions.ts` already established for
 * Workflow suggestions. Returning a recommendation is not applying one:
 * nothing in this module ever calls `updateSetting`/`updateSettingAction`
 * itself — only a human, from the Dashboard's own "Apply" control, does.
 */
interface RecommendationRule {
  settingId: string;
  reason: string;
  /** `undefined` means "no recommendation for this current value." */
  recommend: (currentValue: SettingValue) => SettingValue | undefined;
}

const RECOMMENDATION_RULES: RecommendationRule[] = [
  {
    settingId: "security.mfa-required",
    reason: "Requiring multi-factor authentication meaningfully reduces account-takeover risk for every member.",
    recommend: (value) => (value === false ? true : undefined),
  },
  {
    settingId: "automation.notify-on-failure",
    reason: "Without failure notifications, an Automation can fail silently until someone happens to check the Dashboard.",
    recommend: (value) => (value === false ? true : undefined),
  },
  {
    settingId: "ai.confidence-threshold",
    reason: "A confidence threshold below 50% lets Bloom AI surface low-confidence drafts as if they were ready for review.",
    recommend: (value) => (typeof value === "number" && value < 50 ? 60 : undefined),
  },
  {
    settingId: "finance.payment-terms-days",
    reason: "Payment terms under 7 days are unusually tight and often cause avoidable client friction.",
    recommend: (value) => (typeof value === "number" && value > 0 && value < 7 ? 30 : undefined),
  },
  {
    settingId: "workflow.version-retention-count",
    reason: "Keeping fewer than 5 past versions makes it hard to recover from an unintended Workflow change.",
    recommend: (value) => (typeof value === "number" && value < 5 ? 20 : undefined),
  },
];

/**
 * Evaluates every rule against `values` (a workspace's own current resolved
 * Setting values, e.g. from `getSettingsDashboardData.ts`) and returns one
 * `SettingRecommendation` per rule that fires. Rules for a Setting absent
 * from `values` (not registered, or filtered out by this viewer's own
 * permissions) are silently skipped — never a recommendation for a Setting
 * this member can't act on anyway.
 */
export function getSettingRecommendations(values: Record<string, SettingValue>): SettingRecommendation[] {
  const recommendations: SettingRecommendation[] = [];
  for (const rule of RECOMMENDATION_RULES) {
    if (!(rule.settingId in values)) continue;
    const currentValue = values[rule.settingId];
    const recommendedValue = rule.recommend(currentValue);
    if (recommendedValue === undefined) continue;
    recommendations.push({ settingId: rule.settingId, currentValue, recommendedValue, reason: rule.reason });
  }
  return recommendations;
}
