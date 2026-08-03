import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn().mockResolvedValue({ kind: "unauthenticated" }),
}));

import { resetAllMockData } from "@/lib/data";
import { getClientPortalProfileAction, updateClientPortalPreferencesAction } from "@/modules/clientPortal/getClientPortalProfile";

afterEach(() => {
  vi.clearAllMocks();
});

beforeEach(() => {
  resetAllMockData();
});

describe("getClientPortalProfileAction", () => {
  it("returns the current client's own Personal/Address/Preferences fields", async () => {
    const result = await getClientPortalProfileAction();
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.personal.firstName).toBe("Naomi");
    expect(result.data.personal.lastName).toBe("Whitfield");
    expect(result.data.personal.email).toBe("naomi.whitfield@example.com");
    expect(result.data.address.city).toBe("New York");
  });

  it("never exposes internal-only fields (no do_not_call/allergies/emergency contact in the shape)", async () => {
    const result = await getClientPortalProfileAction();
    expect(result.success).toBe(true);
    if (!result.success) return;

    const serialized = JSON.stringify(result.data);
    expect(serialized).not.toContain("do_not_call");
    expect(serialized).not.toContain("emergency_contact");
    expect(serialized).not.toContain("allergies");
  });

  it("falls back to the CRM record's preferred_contact_method when no portal override is set", async () => {
    const result = await getClientPortalProfileAction();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.communicationPreference).toBe("whatsapp");
  });
});

describe("updateClientPortalPreferencesAction", () => {
  it("persists a communication preference override and getClientPortalProfileAction reflects it", async () => {
    const updated = await updateClientPortalPreferencesAction({ communicationPreference: "email" });
    expect(updated.success).toBe(true);

    const result = await getClientPortalProfileAction();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.communicationPreference).toBe("email");
  });
});
