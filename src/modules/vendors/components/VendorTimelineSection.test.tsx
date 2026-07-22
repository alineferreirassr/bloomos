import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VendorTimelineSection } from "@/modules/vendors/components/VendorTimelineSection";
import { registerDefaultTimelineActivityTypes } from "@/core/timeline";
import type { TimelineActivity } from "@/types/timelineActivity";

vi.mock("@/lib/data", () => ({
  getTimelineByVendorId: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

function makeActivity(overrides: Partial<TimelineActivity> = {}): TimelineActivity {
  return {
    id: "activity_1",
    workspace_id: "ws_test",
    owner_type: "vendor",
    owner_id: "vendor_1",
    type: "vendor_created" as TimelineActivity["type"],
    description: "Vendor created",
    actor: "Amoré Bloom Team",
    timestamp: "2026-01-01T12:00:00.000Z",
    ...overrides,
  };
}

describe("VendorTimelineSection", () => {
  it("shows the empty state specific to Vendor activity history when there are no activities", async () => {
    vi.mocked(dataLayer.getTimelineByVendorId).mockResolvedValue([]);

    render(<VendorTimelineSection vendorId="vendor_1" />);

    expect(await screen.findByText("No activity yet")).toBeInTheDocument();
    expect(screen.getByText(/Actions taken on this vendor/i)).toBeInTheDocument();
  });

  it("shows an error state with retry when loading fails, and retry re-fetches", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.getTimelineByVendorId).mockRejectedValueOnce(new Error("boom"));

    render(<VendorTimelineSection vendorId="vendor_1" />);

    expect(await screen.findByText(/could not load this vendor's activity history/i)).toBeInTheDocument();

    vi.mocked(dataLayer.getTimelineByVendorId).mockResolvedValueOnce([makeActivity({ description: "A new vendor record" })]);
    await user.click(screen.getByRole("button", { name: /try again/i }));

    expect(await screen.findByText("A new vendor record")).toBeInTheDocument();
  });

  it("renders populated activities with actor and timestamp once loaded", async () => {
    registerDefaultTimelineActivityTypes();
    vi.mocked(dataLayer.getTimelineByVendorId).mockResolvedValue([
      makeActivity({ type: "vendor_archived" as TimelineActivity["type"], description: "This vendor was archived", actor: "Jordan Ellis" }),
    ]);

    render(<VendorTimelineSection vendorId="vendor_1" />);

    expect(await screen.findByText("Vendor archived")).toBeInTheDocument();
    expect(screen.getByText(/Jordan Ellis/)).toBeInTheDocument();
  });

  it("passes the vendor id through to getTimelineByVendorId", async () => {
    vi.mocked(dataLayer.getTimelineByVendorId).mockResolvedValue([]);

    render(<VendorTimelineSection vendorId="vendor_42" />);

    await screen.findByText("No activity yet");
    expect(dataLayer.getTimelineByVendorId).toHaveBeenCalledWith("vendor_42");
  });

  it("contains no direct Supabase import", () => {
    const source = readFileSync(path.resolve(__dirname, "VendorTimelineSection.tsx"), "utf-8");
    expect(source).not.toMatch(/from ["']@\/lib\/supabase/);
    expect(source).not.toMatch(/createBrowserClient|createSupabaseClient/);
  });
});
