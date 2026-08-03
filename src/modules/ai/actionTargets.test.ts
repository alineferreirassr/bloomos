import { describe, expect, it } from "vitest";
import { resolveActionTarget } from "@/modules/ai/actionTargets";

describe("resolveActionTarget", () => {
  it("resolves 'checklist' to the real Event checklist route", () => {
    expect(resolveActionTarget("checklist", "event_1")).toEqual({
      type: "checklist",
      href: "/events/event_1/checklist",
      label: "Open Checklist",
    });
  });

  it("resolves 'schedule' to the real Event schedule route", () => {
    expect(resolveActionTarget("schedule", "event_1")).toEqual({
      type: "schedule",
      href: "/events/event_1/schedule",
      label: "Open Schedule",
    });
  });

  it("resolves 'event' to the Event detail route itself", () => {
    expect(resolveActionTarget("event", "event_1")).toEqual({
      type: "event",
      href: "/events/event_1",
      label: "Open Event",
    });
  });

  it("returns null for a null type", () => {
    expect(resolveActionTarget(null, "event_1")).toBeNull();
  });

  it("returns null for any value outside the closed enum, never fabricating a URL", () => {
    // @ts-expect-error deliberately invalid type to prove the guard fires
    expect(resolveActionTarget("https://evil.example.com", "event_1")).toBeNull();
  });

  it("never embeds anything other than the given eventId in the href", () => {
    const target = resolveActionTarget("checklist", "<script>alert(1)</script>");
    expect(target?.href).toBe("/events/<script>alert(1)</script>/checklist");
    // Embedding is literal path interpolation only — no URL parsing, no protocol
    // resolution, no template evaluation; the caller (Next's Link/router) is
    // responsible for standard escaping, same as every other dynamic route.
  });
});
