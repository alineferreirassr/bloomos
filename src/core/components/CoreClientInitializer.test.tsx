import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { CoreClientInitializer } from "@/core/components/CoreClientInitializer";
import { getTimelineActivityLabel, isRegisteredTimelineActivityType } from "@/core/timeline/activityTypeRegistry";

const VENDOR_ACTIVITY_LABELS: Record<string, string> = {
  vendor_created: "Vendor created",
  vendor_updated: "Vendor updated",
  vendor_archived: "Vendor archived",
  vendor_restored: "Vendor restored",
  vendor_preferred_status_changed: "Preferred status changed",
};

describe("CoreClientInitializer", () => {
  it("renders nothing", () => {
    const { container } = render(<CoreClientInitializer />);
    expect(container).toBeEmptyDOMElement();
  });

  it("initializes the Timeline registry so all 5 Vendor labels resolve correctly in the client runtime", () => {
    render(<CoreClientInitializer />);

    for (const [type, label] of Object.entries(VENDOR_ACTIVITY_LABELS)) {
      expect(isRegisteredTimelineActivityType(type)).toBe(true);
      expect(getTimelineActivityLabel(type)).toBe(label);
    }
  });

  it("is safe to mount more than once (repeated client initialization)", () => {
    expect(() => {
      render(<CoreClientInitializer />);
      render(<CoreClientInitializer />);
      render(<CoreClientInitializer />);
    }).not.toThrow();

    for (const [type, label] of Object.entries(VENDOR_ACTIVITY_LABELS)) {
      expect(getTimelineActivityLabel(type)).toBe(label);
    }
  });
});

describe("separation of responsibilities", () => {
  it("Timeline.tsx contains no registration call", () => {
    const source = readFileSync(path.resolve(__dirname, "../../modules/timeline/components/Timeline.tsx"), "utf-8");
    expect(source).not.toMatch(/registerTimelineActivityType\s*\(/);
    expect(source).not.toMatch(/registerDefaultTimelineActivityTypes\s*\(\s*\)/);
    expect(source).toMatch(/getTimelineActivityLabel/);
  });

  it("VendorTimelineSection.tsx contains no registration call", () => {
    const source = readFileSync(
      path.resolve(__dirname, "../../modules/vendors/components/VendorTimelineSection.tsx"),
      "utf-8",
    );
    expect(source).not.toMatch(/registerTimelineActivityType\s*\(/);
    expect(source).not.toMatch(/registerDefaultTimelineActivityTypes\s*\(\s*\)/);
  });

  it("neither Vendor repository contains a registration call", () => {
    const mockSource = readFileSync(path.resolve(__dirname, "../../lib/data/vendors/mockRepository.ts"), "utf-8");
    const supabaseSource = readFileSync(path.resolve(__dirname, "../../lib/data/vendors/supabaseRepository.ts"), "utf-8");
    for (const source of [mockSource, supabaseSource]) {
      expect(source).not.toMatch(/registerTimelineActivityType\s*\(/);
      expect(source).not.toMatch(/registerDefaultTimelineActivityTypes\s*\(\s*\)/);
    }
  });

  it("the root layout mounts CoreClientInitializer alongside the server-side initializeCore()", () => {
    const source = readFileSync(path.resolve(__dirname, "../../app/layout.tsx"), "utf-8");
    expect(source).toMatch(/import\s*{\s*CoreClientInitializer\s*}\s*from\s*["']@\/core\/components\/CoreClientInitializer["']/);
    expect(source).toMatch(/<CoreClientInitializer\s*\/>/);
    expect(source).toMatch(/import\s*{\s*initializeCore\s*}\s*from\s*["']@\/core\/initializeCore["']/);
    expect(source).toMatch(/^initializeCore\(\);\s*$/m);
  });
});
