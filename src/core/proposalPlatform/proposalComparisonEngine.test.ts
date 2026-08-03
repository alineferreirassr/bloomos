import { describe, it, expect } from "vitest";
import { compareProposalVersions } from "@/core/proposalPlatform/proposalComparisonEngine";
import { makeVersion, makeSnapshot, makeSection, makePricingInput } from "@/core/proposalPlatform/testFixtures";
import { computeProposalPricing } from "@/core/proposalPlatform/pricingEngine";

describe("compareProposalVersions", () => {
  it("reports no changes for two identical snapshots", () => {
    const snapshot = makeSnapshot();
    const versionA = makeVersion({ version_number: 1, snapshot });
    const versionB = makeVersion({ version_number: 2, snapshot });
    const result = compareProposalVersions(versionA, versionB);
    expect(result.hasChanges).toBe(false);
    expect(result.diffs).toHaveLength(0);
  });

  it("detects a pricing change", () => {
    const versionA = makeVersion({ version_number: 1, snapshot: makeSnapshot({ pricing: computeProposalPricing(makePricingInput()) }) });
    const versionB = makeVersion({ version_number: 2, snapshot: makeSnapshot({ pricing: computeProposalPricing(makePricingInput({ discount: { type: "percentage", value: 10, label: null } })) }) });
    const result = compareProposalVersions(versionA, versionB);
    expect(result.hasChanges).toBe(true);
    expect(result.diffs.some((d) => d.category === "pricing" && d.field === "Grand Total")).toBe(true);
  });

  it("detects an added section", () => {
    const base = makeSnapshot();
    const versionA = makeVersion({ version_number: 1, snapshot: base });
    const versionB = makeVersion({ version_number: 2, snapshot: makeSnapshot({ sections: [...base.sections, makeSection({ title: "FAQ" })] }) });
    const result = compareProposalVersions(versionA, versionB);
    expect(result.diffs.some((d) => d.category === "sections" && d.changeType === "added")).toBe(true);
  });

  it("detects a removed package", () => {
    const versionA = makeVersion({ version_number: 1, snapshot: makeSnapshot({ packageIds: ["pkg_1", "pkg_2"] }) });
    const versionB = makeVersion({ version_number: 2, snapshot: makeSnapshot({ packageIds: ["pkg_1"] }) });
    const result = compareProposalVersions(versionA, versionB);
    expect(result.diffs.some((d) => d.category === "packages" && d.changeType === "removed" && d.before === "pkg_2")).toBe(true);
  });

  it("detects an added add-on", () => {
    const versionA = makeVersion({ version_number: 1, snapshot: makeSnapshot({ addonIds: [] }) });
    const versionB = makeVersion({ version_number: 2, snapshot: makeSnapshot({ addonIds: ["addon_1"] }) });
    const result = compareProposalVersions(versionA, versionB);
    expect(result.diffs.some((d) => d.category === "addons" && d.changeType === "added")).toBe(true);
  });

  it("detects a changed variable value", () => {
    const versionA = makeVersion({ version_number: 1, snapshot: makeSnapshot({ variables: [{ key: "client_name", label: "Client Name", value: "Jordan" }] }) });
    const versionB = makeVersion({ version_number: 2, snapshot: makeSnapshot({ variables: [{ key: "client_name", label: "Client Name", value: "Alex" }] }) });
    const result = compareProposalVersions(versionA, versionB);
    expect(result.diffs.some((d) => d.category === "variables" && d.before === "Jordan" && d.after === "Alex")).toBe(true);
  });

  it("detects changed terms text", () => {
    const versionA = makeVersion({ version_number: 1, snapshot: makeSnapshot({ terms: "Old terms" }) });
    const versionB = makeVersion({ version_number: 2, snapshot: makeSnapshot({ terms: "New terms" }) });
    const result = compareProposalVersions(versionA, versionB);
    expect(result.diffs.some((d) => d.category === "terms")).toBe(true);
  });

  it("detects changed policies text", () => {
    const versionA = makeVersion({ version_number: 1, snapshot: makeSnapshot({ policies: "Old policy" }) });
    const versionB = makeVersion({ version_number: 2, snapshot: makeSnapshot({ policies: "New policy" }) });
    const result = compareProposalVersions(versionA, versionB);
    expect(result.diffs.some((d) => d.category === "policies")).toBe(true);
  });

  it("detects an added image", () => {
    const versionA = makeVersion({ version_number: 1, snapshot: makeSnapshot({ hero: { headline: "H", subheadline: null, imageAssetId: null } }) });
    const versionB = makeVersion({ version_number: 2, snapshot: makeSnapshot({ hero: { headline: "H", subheadline: null, imageAssetId: "asset_1" } }) });
    const result = compareProposalVersions(versionA, versionB);
    expect(result.diffs.some((d) => d.category === "images" && d.changeType === "added")).toBe(true);
  });

  it("preserves the version numbers being compared", () => {
    const versionA = makeVersion({ version_number: 3 });
    const versionB = makeVersion({ version_number: 5 });
    const result = compareProposalVersions(versionA, versionB);
    expect(result.versionANumber).toBe(3);
    expect(result.versionBNumber).toBe(5);
  });
});
