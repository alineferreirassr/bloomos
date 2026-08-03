import { describe, it, expect } from "vitest";
import { assembleSnapshot, nextVersionNumber, buildContractVersion, nextStatusAfterVersion, currentVersionOf, type AssembleContractSnapshotInput } from "@/core/contractPlatform/contractBuilderEngine";
import { makeSection, makeHeader, makeFooter, makeVersion, makeBuilderState, makePricingReference } from "@/core/contractPlatform/testFixtures";
import type { CreateContractVersionInput } from "@/types/contractPlatform";

function createInput(overrides: Partial<CreateContractVersionInput> = {}): CreateContractVersionInput {
  return {
    builderTemplateId: "tmpl_1",
    builderTemplateKey: "proposal_agreement",
    header: makeHeader(),
    sections: [makeSection()],
    clauseIds: ["clause_1"],
    terms: "Terms",
    policies: "Policies",
    footer: makeFooter(),
    notes: null,
    reason: null,
    ...overrides,
  };
}

function input(overrides: Partial<AssembleContractSnapshotInput> = {}): AssembleContractSnapshotInput {
  return {
    createInput: createInput(),
    variables: [{ key: "client_name", label: "Client Name", value: "Jordan Rivera" }],
    pricingReference: makePricingReference(),
    attachmentIds: ["exhibit_1"],
    ...overrides,
  };
}

describe("assembleSnapshot", () => {
  it("freezes a snapshot with the resolved variables and pricing reference", () => {
    const snapshot = assembleSnapshot(input());
    expect(snapshot.variables).toHaveLength(1);
    expect(snapshot.pricingReference?.grandTotal_minor).toBeGreaterThan(0);
  });

  it("carries the template reference through", () => {
    const snapshot = assembleSnapshot(input({ createInput: createInput({ builderTemplateId: "tmpl_9", builderTemplateKey: "nda" }) }));
    expect(snapshot.builderTemplateId).toBe("tmpl_9");
    expect(snapshot.builderTemplateKey).toBe("nda");
  });

  it("freezes attachment ids by reference list only", () => {
    const snapshot = assembleSnapshot(input({ attachmentIds: ["exhibit_1", "exhibit_2"] }));
    expect(snapshot.attachmentIds).toEqual(["exhibit_1", "exhibit_2"]);
  });
});

describe("nextVersionNumber", () => {
  it("returns 1 for an empty version history", () => {
    expect(nextVersionNumber([])).toBe(1);
  });

  it("returns max + 1 for a non-empty history", () => {
    const versions = [makeVersion({ version_number: 1 }), makeVersion({ version_number: 2 })];
    expect(nextVersionNumber(versions)).toBe(3);
  });
});

describe("buildContractVersion", () => {
  it("builds version 1 for a contract with no prior versions", () => {
    const version = buildContractVersion("contract_1", "ws_1", [], input(), "member_1");
    expect(version.version_number).toBe(1);
    expect(version.contract_id).toBe("contract_1");
  });

  it("never mutates the existing versions array it was given", () => {
    const existing = [makeVersion({ version_number: 1 })];
    const before = [...existing];
    buildContractVersion("contract_1", "ws_1", existing, input(), "member_1");
    expect(existing).toEqual(before);
  });
});

describe("nextStatusAfterVersion", () => {
  it("leaves a first version in draft", () => {
    expect(nextStatusAfterVersion("draft", true)).toBe("draft");
  });

  it("moves a published document to review when a new version is added", () => {
    expect(nextStatusAfterVersion("published", false)).toBe("review");
  });

  it("leaves a draft document in draft when a later version is added before publishing", () => {
    expect(nextStatusAfterVersion("draft", false)).toBe("draft");
  });
});

describe("currentVersionOf", () => {
  it("resolves the version matching current_version_id", () => {
    const state = makeBuilderState();
    const version = currentVersionOf(state);
    expect(version?.id).toBe(state.current_version_id);
  });

  it("returns null when current_version_id is null", () => {
    const state = makeBuilderState({ current_version_id: null });
    expect(currentVersionOf(state)).toBeNull();
  });
});
