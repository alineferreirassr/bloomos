import { describe, expect, it } from "vitest";
import { deriveStatus } from "@/core/communication/presenceEngine";

const NOW = new Date("2026-07-15T12:00:00.000Z");

describe("deriveStatus", () => {
  it("is online within 5 minutes of last activity", () => {
    expect(deriveStatus("2026-07-15T11:57:00.000Z", null, NOW)).toBe("online");
  });

  it("is away between 5 and 15 minutes", () => {
    expect(deriveStatus("2026-07-15T11:50:00.000Z", null, NOW)).toBe("away");
  });

  it("is offline past 15 minutes", () => {
    expect(deriveStatus("2026-07-15T11:00:00.000Z", null, NOW)).toBe("offline");
  });

  it("a manual busy/dnd status always wins over recency", () => {
    expect(deriveStatus("2026-07-15T11:59:00.000Z", "busy", NOW)).toBe("busy");
    expect(deriveStatus("2026-07-01T00:00:00.000Z", "dnd", NOW)).toBe("dnd");
  });
});
