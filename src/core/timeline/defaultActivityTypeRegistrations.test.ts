import { describe, expect, it } from "vitest";
import { registerDefaultTimelineActivityTypes } from "@/core/timeline/defaultActivityTypeRegistrations";
import { isRegisteredTimelineActivityType, getTimelineActivityLabel } from "@/core/timeline/activityTypeRegistry";

describe("registerDefaultTimelineActivityTypes", () => {
  it("registers all 5 Vendor activity types with display labels", () => {
    registerDefaultTimelineActivityTypes();

    const expected: Record<string, string> = {
      vendor_created: "Vendor created",
      vendor_updated: "Vendor updated",
      vendor_archived: "Vendor archived",
      vendor_restored: "Vendor restored",
      vendor_preferred_status_changed: "Preferred status changed",
    };

    for (const [type, label] of Object.entries(expected)) {
      expect(isRegisteredTimelineActivityType(type)).toBe(true);
      expect(getTimelineActivityLabel(type)).toBe(label);
    }
  });
});
