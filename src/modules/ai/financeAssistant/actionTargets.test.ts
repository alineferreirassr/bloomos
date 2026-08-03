import { describe, expect, it } from "vitest";
import { resolveFinanceAssistantActionTarget } from "@/modules/ai/financeAssistant/actionTargets";

describe("resolveFinanceAssistantActionTarget", () => {
  it("returns null when type or id is null", () => {
    expect(resolveFinanceAssistantActionTarget(null, "id_1")).toBeNull();
    expect(resolveFinanceAssistantActionTarget("invoice", null)).toBeNull();
  });

  it("resolves every closed target type to a real, existing BloomOS route", () => {
    expect(resolveFinanceAssistantActionTarget("invoice", "i1")).toEqual({ type: "invoice", href: "/finance/invoices/i1", label: "Open Invoice" });
    expect(resolveFinanceAssistantActionTarget("contract", "ct1")).toEqual({ type: "contract", href: "/contracts/ct1", label: "Open Contract" });
    expect(resolveFinanceAssistantActionTarget("event", "e1")).toEqual({ type: "event", href: "/events/e1", label: "Open Event" });
  });
});
