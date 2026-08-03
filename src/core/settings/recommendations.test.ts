import { describe, expect, it } from "vitest";
import { getSettingRecommendations } from "@/core/settings/recommendations";

describe("getSettingRecommendations", () => {
  it("recommends enabling MFA when it's currently disabled", () => {
    const recommendations = getSettingRecommendations({ "security.mfa-required": false });
    expect(recommendations).toHaveLength(1);
    expect(recommendations[0]).toMatchObject({ settingId: "security.mfa-required", currentValue: false, recommendedValue: true });
  });

  it("recommends nothing when MFA is already enabled", () => {
    expect(getSettingRecommendations({ "security.mfa-required": true })).toEqual([]);
  });

  it("recommends raising a low AI confidence threshold", () => {
    const recommendations = getSettingRecommendations({ "ai.confidence-threshold": 20 });
    expect(recommendations[0]).toMatchObject({ settingId: "ai.confidence-threshold", currentValue: 20, recommendedValue: 60 });
  });

  it("recommends nothing for an AI confidence threshold already at or above 50", () => {
    expect(getSettingRecommendations({ "ai.confidence-threshold": 60 })).toEqual([]);
  });

  it("skips a rule whose setting isn't present in the given values", () => {
    expect(getSettingRecommendations({})).toEqual([]);
  });

  it("evaluates every rule independently and can return several recommendations at once", () => {
    const recommendations = getSettingRecommendations({
      "security.mfa-required": false,
      "automation.notify-on-failure": false,
      "ai.confidence-threshold": 60,
    });
    const settingIds = recommendations.map((r) => r.settingId).sort();
    expect(settingIds).toEqual(["automation.notify-on-failure", "security.mfa-required"]);
  });

  it("never recommends a value equal to the current one", () => {
    const recommendations = getSettingRecommendations({ "finance.payment-terms-days": 30 });
    expect(recommendations).toEqual([]);
  });
});
