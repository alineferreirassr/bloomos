import { describe, it, expect } from "vitest";
import { evaluateTransitionRequest } from "./journeyTransitionEngine";
import type { JourneyRequirementResult } from "@/types/clientJourney";

function req(met: boolean): JourneyRequirementResult {
  return { key: "k", label: "Label", stage: "proposal_sent", met, sourceModule: "proposal", sourceRecordId: null, detail: "" };
}

describe("evaluateTransitionRequest", () => {
  it("allows advancing to a later stage when every requirement is met", () => {
    const result = evaluateTransitionRequest("qualified", { kind: "advance", targetStage: "proposal_sent" }, [req(true), req(true)]);
    expect(result).toEqual({ type: "allowed", allowed: true, blockingRules: [] });
  });

  it("blocks advancing when a requirement is unmet, listing the failed label", () => {
    const result = evaluateTransitionRequest("qualified", { kind: "advance", targetStage: "proposal_sent" }, [req(true), req(false)]);
    expect(result.allowed).toBe(false);
    expect(result.type).toBe("blocked");
    expect(result.blockingRules).toEqual(["Label"]);
  });

  it("blocks advancing to a stage that is not ahead of the current stage", () => {
    const result = evaluateTransitionRequest("proposal_sent", { kind: "advance", targetStage: "qualified" }, []);
    expect(result.allowed).toBe(false);
  });

  it("allows skipping an optional stage", () => {
    const result = evaluateTransitionRequest("qualified", { kind: "skip_optional", targetStage: "proposal_preparation" }, []);
    expect(result).toEqual({ type: "skipped_optional", allowed: true, blockingRules: [] });
  });

  it("blocks skipping over a required (non-optional) stage", () => {
    const result = evaluateTransitionRequest("proposal_accepted", { kind: "skip_optional", targetStage: "contract_signed" }, []);
    expect(result.allowed).toBe(false);
    expect(result.blockingRules[0]).toContain("contract_preparation");
  });

  it("allows cancelling a non-terminal journey", () => {
    const result = evaluateTransitionRequest("proposal_sent", { kind: "cancel", targetStage: "cancelled" }, []);
    expect(result).toEqual({ type: "cancelled", allowed: true, blockingRules: [] });
  });

  it("blocks cancelling an already-terminal journey", () => {
    const result = evaluateTransitionRequest("closed", { kind: "cancel", targetStage: "cancelled" }, []);
    expect(result.allowed).toBe(false);
  });

  it("allows marking a pre-closed journey as lost", () => {
    const result = evaluateTransitionRequest("proposal_sent", { kind: "lose", targetStage: "lost" }, []);
    expect(result).toEqual({ type: "lost", allowed: true, blockingRules: [] });
  });

  it("blocks marking a closed-or-later journey as lost", () => {
    const result = evaluateTransitionRequest("closed", { kind: "lose", targetStage: "lost" }, []);
    expect(result.allowed).toBe(false);
  });

  it("allows restoring a lost journey", () => {
    const result = evaluateTransitionRequest("lost", { kind: "restore", targetStage: "qualified" }, []);
    expect(result).toEqual({ type: "restored", allowed: true, blockingRules: [] });
  });

  it("blocks restoring a journey that isn't lost or cancelled", () => {
    const result = evaluateTransitionRequest("proposal_sent", { kind: "restore", targetStage: "qualified" }, []);
    expect(result.allowed).toBe(false);
  });

  it("allows reopening to an earlier stage", () => {
    const result = evaluateTransitionRequest("contract_signed", { kind: "reopen", targetStage: "proposal_sent" }, []);
    expect(result).toEqual({ type: "reopened", allowed: true, blockingRules: [] });
  });

  it("blocks reopening to a stage that isn't earlier", () => {
    const result = evaluateTransitionRequest("proposal_sent", { kind: "reopen", targetStage: "contract_signed" }, []);
    expect(result.allowed).toBe(false);
  });
});
