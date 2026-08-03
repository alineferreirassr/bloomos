import { describe, it, expect } from "vitest";
import { compareContractVersions } from "@/core/contractPlatform/contractComparisonEngine";
import { makeVersion, makeSnapshot, makeSection, makePricingReference } from "@/core/contractPlatform/testFixtures";

describe("compareContractVersions", () => {
  it("reports no changes for two identical snapshots", () => {
    const snapshot = makeSnapshot();
    const versionA = makeVersion({ version_number: 1, snapshot });
    const versionB = makeVersion({ version_number: 2, snapshot });
    const result = compareContractVersions(versionA, versionB);
    expect(result.hasChanges).toBe(false);
    expect(result.diffs).toHaveLength(0);
  });

  it("detects an added clause", () => {
    const versionA = makeVersion({ version_number: 1, snapshot: makeSnapshot({ clauseIds: ["clause_1"] }) });
    const versionB = makeVersion({ version_number: 2, snapshot: makeSnapshot({ clauseIds: ["clause_1", "clause_2"] }) });
    const result = compareContractVersions(versionA, versionB);
    expect(result.diffs.some((d) => d.category === "clauses" && d.changeType === "added" && d.after === "clause_2")).toBe(true);
  });

  it("detects a removed clause", () => {
    const versionA = makeVersion({ version_number: 1, snapshot: makeSnapshot({ clauseIds: ["clause_1", "clause_2"] }) });
    const versionB = makeVersion({ version_number: 2, snapshot: makeSnapshot({ clauseIds: ["clause_1"] }) });
    const result = compareContractVersions(versionA, versionB);
    expect(result.diffs.some((d) => d.category === "clauses" && d.changeType === "removed" && d.before === "clause_2")).toBe(true);
  });

  it("detects a changed variable value", () => {
    const versionA = makeVersion({ version_number: 1, snapshot: makeSnapshot({ variables: [{ key: "client_name", label: "Client Name", value: "Jordan" }] }) });
    const versionB = makeVersion({ version_number: 2, snapshot: makeSnapshot({ variables: [{ key: "client_name", label: "Client Name", value: "Alex" }] }) });
    const result = compareContractVersions(versionA, versionB);
    expect(result.diffs.some((d) => d.category === "variables" && d.before === "Jordan" && d.after === "Alex")).toBe(true);
  });

  it("detects a pricing reference change", () => {
    const versionA = makeVersion({ version_number: 1, snapshot: makeSnapshot({ pricingReference: makePricingReference({ grandTotal_minor: 65000 }) }) });
    const versionB = makeVersion({ version_number: 2, snapshot: makeSnapshot({ pricingReference: makePricingReference({ grandTotal_minor: 70000 }) }) });
    const result = compareContractVersions(versionA, versionB);
    expect(result.diffs.some((d) => d.category === "pricing_references" && d.field === "Grand Total")).toBe(true);
  });

  it("detects an added section", () => {
    const base = makeSnapshot();
    const versionA = makeVersion({ version_number: 1, snapshot: base });
    const versionB = makeVersion({ version_number: 2, snapshot: makeSnapshot({ sections: [...base.sections, makeSection({ title: "Signatures" })] }) });
    const result = compareContractVersions(versionA, versionB);
    expect(result.diffs.some((d) => d.category === "sections" && d.changeType === "added")).toBe(true);
  });

  it("detects an added attachment", () => {
    const versionA = makeVersion({ version_number: 1, snapshot: makeSnapshot({ attachmentIds: [] }) });
    const versionB = makeVersion({ version_number: 2, snapshot: makeSnapshot({ attachmentIds: ["exhibit_1"] }) });
    const result = compareContractVersions(versionA, versionB);
    expect(result.diffs.some((d) => d.category === "attachments" && d.changeType === "added")).toBe(true);
  });

  it("detects changed terms text", () => {
    const versionA = makeVersion({ version_number: 1, snapshot: makeSnapshot({ terms: "Old terms" }) });
    const versionB = makeVersion({ version_number: 2, snapshot: makeSnapshot({ terms: "New terms" }) });
    const result = compareContractVersions(versionA, versionB);
    expect(result.diffs.some((d) => d.category === "terms")).toBe(true);
  });

  it("detects changed policies text", () => {
    const versionA = makeVersion({ version_number: 1, snapshot: makeSnapshot({ policies: "Old policy" }) });
    const versionB = makeVersion({ version_number: 2, snapshot: makeSnapshot({ policies: "New policy" }) });
    const result = compareContractVersions(versionA, versionB);
    expect(result.diffs.some((d) => d.category === "policies")).toBe(true);
  });

  it("preserves the version numbers being compared", () => {
    const versionA = makeVersion({ version_number: 3 });
    const versionB = makeVersion({ version_number: 5 });
    const result = compareContractVersions(versionA, versionB);
    expect(result.versionANumber).toBe(3);
    expect(result.versionBNumber).toBe(5);
  });
});
