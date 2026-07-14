import { describe, expect, it } from "vitest";
import {
  canTransition,
  getNextRecommendedAction,
  getNextStatuses,
  isTerminalStatus,
  LEAD_STATUSES,
} from "@/core/workflows/leadWorkflow";

describe("isTerminalStatus", () => {
  it("is true only for converted and archived", () => {
    expect(isTerminalStatus("converted")).toBe(true);
    expect(isTerminalStatus("archived")).toBe(true);
    for (const status of LEAD_STATUSES) {
      if (status === "converted" || status === "archived") continue;
      expect(isTerminalStatus(status)).toBe(false);
    }
  });
});

describe("canTransition", () => {
  it("disallows transitioning to the same status", () => {
    expect(canTransition("new", "new")).toBe(false);
  });

  it("disallows any transition away from a terminal status", () => {
    expect(canTransition("converted", "new")).toBe(false);
    expect(canTransition("archived", "contacted")).toBe(false);
  });

  it("disallows transitioning directly into converted or archived", () => {
    expect(canTransition("new", "converted")).toBe(false);
    expect(canTransition("qualified", "archived")).toBe(false);
  });

  it("allows moving between two working statuses, forward or backward", () => {
    expect(canTransition("new", "qualified")).toBe(true);
    expect(canTransition("proposal_sent", "contacted")).toBe(true);
  });

  it("allows moving to lost from any working status", () => {
    expect(canTransition("qualified", "lost")).toBe(true);
  });
});

describe("getNextStatuses", () => {
  it("returns an empty list for terminal statuses", () => {
    expect(getNextStatuses("converted")).toEqual([]);
    expect(getNextStatuses("archived")).toEqual([]);
  });

  it("never includes the current status or a locked status", () => {
    const next = getNextStatuses("qualified");
    expect(next).not.toContain("qualified");
    expect(next).not.toContain("converted");
    expect(next).not.toContain("archived");
  });
});

describe("getNextRecommendedAction", () => {
  it("returns null for terminal or lost leads", () => {
    expect(getNextRecommendedAction({ status: "converted" })).toBeNull();
    expect(getNextRecommendedAction({ status: "archived" })).toBeNull();
    expect(getNextRecommendedAction({ status: "lost" })).toBeNull();
  });

  it("returns a concrete suggestion for active working statuses", () => {
    expect(getNextRecommendedAction({ status: "new" })).toMatch(/reach out/i);
    expect(getNextRecommendedAction({ status: "contacted" })).toMatch(/welcome guide/i);
  });
});
