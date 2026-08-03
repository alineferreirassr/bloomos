import { describe, expect, it } from "vitest";
import { resolveCrmAssistantActionTarget } from "@/modules/ai/crmAssistant/actionTargets";

describe("resolveCrmAssistantActionTarget", () => {
  it("returns null when type or id is null", () => {
    expect(resolveCrmAssistantActionTarget(null, "id_1")).toBeNull();
    expect(resolveCrmAssistantActionTarget("client", null)).toBeNull();
  });

  it("resolves every closed target type to a real, existing BloomOS route", () => {
    expect(resolveCrmAssistantActionTarget("client", "c1")).toEqual({ type: "client", href: "/clients/c1", label: "Open Client" });
    expect(resolveCrmAssistantActionTarget("lead", "l1")).toEqual({ type: "lead", href: "/leads/l1", label: "Open Lead" });
    expect(resolveCrmAssistantActionTarget("event", "e1")).toEqual({ type: "event", href: "/events/e1", label: "Open Event" });
    expect(resolveCrmAssistantActionTarget("contract", "ct1")).toEqual({ type: "contract", href: "/contracts/ct1", label: "Open Contract" });
    expect(resolveCrmAssistantActionTarget("invoice", "i1")).toEqual({ type: "invoice", href: "/finance/invoices/i1", label: "Open Invoice" });
  });
});
