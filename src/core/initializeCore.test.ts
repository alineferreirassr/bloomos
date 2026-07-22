import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { initializeCore } from "@/core/initializeCore";
import { isRegisteredTimelineActivityType, getTimelineActivityLabel } from "@/core/timeline/activityTypeRegistry";

const VENDOR_ACTIVITY_LABELS: Record<string, string> = {
  vendor_created: "Vendor created",
  vendor_updated: "Vendor updated",
  vendor_archived: "Vendor archived",
  vendor_restored: "Vendor restored",
  vendor_preferred_status_changed: "Preferred status changed",
};

describe("initializeCore", () => {
  it("registers all 5 Vendor Timeline activity types with their display labels", () => {
    initializeCore();
    for (const [type, label] of Object.entries(VENDOR_ACTIVITY_LABELS)) {
      expect(isRegisteredTimelineActivityType(type)).toBe(true);
      expect(getTimelineActivityLabel(type)).toBe(label);
    }
  });

  it("is safe to call more than once (idempotent)", () => {
    expect(() => {
      initializeCore();
      initializeCore();
      initializeCore();
    }).not.toThrow();
    for (const [type, label] of Object.entries(VENDOR_ACTIVITY_LABELS)) {
      expect(getTimelineActivityLabel(type)).toBe(label);
    }
  });
});

describe("production initialization path", () => {
  it("the root layout imports and calls initializeCore() at module scope", () => {
    const layoutSource = readFileSync(path.resolve(__dirname, "../app/layout.tsx"), "utf-8");
    expect(layoutSource).toMatch(/import\s*{\s*initializeCore\s*}\s*from\s*["']@\/core\/initializeCore["']/);
    expect(layoutSource).toMatch(/^initializeCore\(\);\s*$/m);
  });
});

describe("Vendors repositories never register Timeline activity types themselves", () => {
  it("supabaseRepository.ts contains no registration calls", () => {
    const source = readFileSync(path.resolve(__dirname, "../lib/data/vendors/supabaseRepository.ts"), "utf-8");
    expect(source).not.toMatch(/registerTimelineActivityType\s*\(/);
    expect(source).not.toMatch(/registerDefaultTimelineActivityTypes\s*\(\s*\)/);
  });

  it("mockRepository.ts contains no registration calls", () => {
    const source = readFileSync(path.resolve(__dirname, "../lib/data/vendors/mockRepository.ts"), "utf-8");
    expect(source).not.toMatch(/registerTimelineActivityType\s*\(/);
    expect(source).not.toMatch(/registerDefaultTimelineActivityTypes\s*\(\s*\)/);
  });
});
