import { describe, expect, it } from "vitest";
import { resolveDailyBriefActionTarget } from "@/modules/ai/dailyBrief/actionTargets";

describe("resolveDailyBriefActionTarget", () => {
  it("resolves an event target to the real Event route", () => {
    expect(resolveDailyBriefActionTarget("event", "event_1")).toEqual({ type: "event", href: "/events/event_1", label: "Open Event" });
  });

  it("resolves an invoice target to the real Invoice route", () => {
    expect(resolveDailyBriefActionTarget("invoice", "inv_1")).toEqual({ type: "invoice", href: "/finance/invoices/inv_1", label: "Open Invoice" });
  });

  it("resolves a contract target to the real Contract route", () => {
    expect(resolveDailyBriefActionTarget("contract", "contract_1")).toEqual({ type: "contract", href: "/contracts/contract_1", label: "Open Contract" });
  });

  it("returns null when type is null", () => {
    expect(resolveDailyBriefActionTarget(null, "event_1")).toBeNull();
  });

  it("returns null when targetId is null, even with a valid type", () => {
    expect(resolveDailyBriefActionTarget("event", null)).toBeNull();
  });
});
