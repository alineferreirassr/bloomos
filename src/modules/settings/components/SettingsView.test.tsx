import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/modules/settings/getSettingsPageData", () => ({ getSettingsPageData: vi.fn() }));
vi.mock("@/modules/settings/getSettingsDashboardData", () => ({ getSettingsDashboardData: vi.fn() }));
vi.mock("@/modules/settings/updateSettingAction", () => ({ updateSettingAction: vi.fn() }));
vi.mock("@/core/commandPalette", () => ({ registerCommand: vi.fn(), unregisterCommand: vi.fn() }));

import { getSettingsPageData } from "@/modules/settings/getSettingsPageData";
import { getSettingsDashboardData } from "@/modules/settings/getSettingsDashboardData";
import { SettingsView } from "@/modules/settings/components/SettingsView";
import type { SettingsPageData } from "@/modules/settings/getSettingsPageData";

function pageData(overrides: Partial<SettingsPageData> = {}): SettingsPageData {
  return {
    sections: [{ id: "general", label: "General", description: "Where BloomOS takes you first.", icon: "LayoutDashboard", order: 0 }],
    settingsBySection: { general: [] },
    values: {},
    workspaceId: "ws_1",
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("SettingsView — Google Calendar navigation entry (GC02-02)", () => {
  it("GC02-02R-Z:3. shows a Google Calendar entry", async () => {
    vi.mocked(getSettingsPageData).mockResolvedValue({ success: true, data: pageData() });
    vi.mocked(getSettingsDashboardData).mockResolvedValue({ success: false, error: "unavailable" });

    render(<SettingsView />);

    expect(await screen.findByText("Google Calendar")).toBeInTheDocument();
  });

  it("GC02-02R-Z:4. the entry links to the dedicated Google Calendar settings subpage", async () => {
    vi.mocked(getSettingsPageData).mockResolvedValue({ success: true, data: pageData() });
    vi.mocked(getSettingsDashboardData).mockResolvedValue({ success: false, error: "unavailable" });

    render(<SettingsView />);

    const link = await screen.findByRole("link", { name: "Manage" });
    expect(link).toHaveAttribute("href", "/settings/integrations/google-calendar");
  });

  it("GC02-02R-Z:5. the generic field renderer is untouched — a normal Setting still renders through SettingField as before", async () => {
    vi.mocked(getSettingsPageData).mockResolvedValue({
      success: true,
      data: pageData({
        settingsBySection: {
          general: [
            {
              id: "general.default-landing-page",
              sectionId: "general",
              category: null,
              label: "Default Landing Page",
              description: "The page a member lands on right after signing in.",
              keywords: [],
              type: "select",
              options: [{ label: "Dashboard", value: "/dashboard" }],
              defaultValue: "/dashboard",
              required: true,
              visibility: "visible",
              version: "v1",
            },
          ],
        },
      }),
    });
    vi.mocked(getSettingsDashboardData).mockResolvedValue({ success: false, error: "unavailable" });

    render(<SettingsView />);

    expect(await screen.findByText("Default Landing Page")).toBeInTheDocument();
  });

  it("shows the Google Calendar entry even when no sections are visible to this role", async () => {
    vi.mocked(getSettingsPageData).mockResolvedValue({ success: true, data: pageData({ sections: [], settingsBySection: {} }) });
    vi.mocked(getSettingsDashboardData).mockResolvedValue({ success: false, error: "unavailable" });

    render(<SettingsView />);

    expect(await screen.findByText("Google Calendar")).toBeInTheDocument();
    expect(screen.getByText("No settings are visible to your role yet.")).toBeInTheDocument();
  });
});
