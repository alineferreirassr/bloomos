import { afterEach, describe, expect, it, vi } from "vitest";
import { registerSkillRunner, unregisterSkillRunner, getSkillRunner, resetSkillRunnerRegistry } from "@/core/ai/skills/runnerRegistry";

describe("Skill Runner Registry", () => {
  afterEach(() => resetSkillRunnerRegistry());

  it("registers and retrieves a runner by Skill id", () => {
    const runner = vi.fn();
    registerSkillRunner("proposal.generate", runner);
    expect(getSkillRunner("proposal.generate")).toBe(runner);
  });

  it("returns undefined when no runner is registered for a Skill", () => {
    expect(getSkillRunner("event-operations-brief")).toBeUndefined();
  });

  it("replaces an existing runner when registered again under the same Skill id", () => {
    const first = vi.fn();
    const second = vi.fn();
    registerSkillRunner("proposal.generate", first);
    registerSkillRunner("proposal.generate", second);
    expect(getSkillRunner("proposal.generate")).toBe(second);
  });

  it("removes a runner on unregister", () => {
    registerSkillRunner("proposal.generate", vi.fn());
    unregisterSkillRunner("proposal.generate");
    expect(getSkillRunner("proposal.generate")).toBeUndefined();
  });

  it("unregistering an unknown Skill id is a no-op", () => {
    expect(() => unregisterSkillRunner("ghost")).not.toThrow();
  });

  it("resets to empty", () => {
    registerSkillRunner("proposal.generate", vi.fn());
    resetSkillRunnerRegistry();
    expect(getSkillRunner("proposal.generate")).toBeUndefined();
  });
});
