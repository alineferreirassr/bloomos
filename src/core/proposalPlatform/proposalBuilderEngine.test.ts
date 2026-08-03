import { describe, it, expect } from "vitest";
import { assembleSnapshot, nextVersionNumber, buildProposalVersion, nextStatusAfterVersion, currentVersionOf } from "@/core/proposalPlatform/proposalBuilderEngine";
import { makePricingInput, makeSection, makeHeader, makeHero, makeFooter, makeVersion, makeBuilderState } from "@/core/proposalPlatform/testFixtures";
import type { CreateProposalVersionInput } from "@/types/proposalPlatform";

function input(overrides: Partial<CreateProposalVersionInput> = {}): CreateProposalVersionInput {
  return {
    templateId: "tmpl_1",
    templateKey: "picnic_proposal",
    header: makeHeader(),
    hero: makeHero(),
    sections: [makeSection()],
    packageIds: ["pkg_1"],
    addonIds: [],
    variables: [],
    pricingInput: makePricingInput(),
    terms: "Terms",
    policies: "Policies",
    footer: makeFooter(),
    notes: null,
    reason: null,
    ...overrides,
  };
}

describe("assembleSnapshot", () => {
  it("freezes a snapshot with computed pricing", () => {
    const snapshot = assembleSnapshot(input());
    expect(snapshot.pricing.grandTotal_minor).toBeGreaterThan(0);
    expect(snapshot.sections).toHaveLength(1);
  });

  it("carries the template reference through", () => {
    const snapshot = assembleSnapshot(input({ templateId: "tmpl_9", templateKey: "luxury_proposal" }));
    expect(snapshot.template_id).toBe("tmpl_9");
    expect(snapshot.templateKey).toBe("luxury_proposal");
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

describe("buildProposalVersion", () => {
  it("builds version 1 for a proposal with no prior versions", () => {
    const version = buildProposalVersion("proposal_1", "ws_1", [], input(), "member_1");
    expect(version.version_number).toBe(1);
    expect(version.proposal_id).toBe("proposal_1");
  });

  it("never mutates the existing versions array it was given", () => {
    const existing = [makeVersion({ version_number: 1 })];
    const before = [...existing];
    buildProposalVersion("proposal_1", "ws_1", existing, input(), "member_1");
    expect(existing).toEqual(before);
  });
});

describe("nextStatusAfterVersion", () => {
  it("leaves a first version in draft", () => {
    expect(nextStatusAfterVersion("draft", true)).toBe("draft");
  });

  it("moves a published document to revision when a new version is added", () => {
    expect(nextStatusAfterVersion("published", false)).toBe("revision");
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
