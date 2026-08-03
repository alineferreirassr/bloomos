import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/modules/clientPortal/getClientPortalProfile", () => ({
  getClientPortalProfileAction: vi.fn(),
  updateClientPortalPreferencesAction: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

import { ClientPortalSettingsView } from "@/modules/clientPortal/components/ClientPortalSettingsView";
import { getClientPortalProfileAction, updateClientPortalPreferencesAction } from "@/modules/clientPortal/getClientPortalProfile";

const PROFILE = {
  personal: { firstName: "Naomi", lastName: "Whitfield", email: "naomi.whitfield@example.com", phone: null, instagram: null, partnerName: null },
  address: { address: null, city: null, state: null, zipCode: null },
  preferences: { favoriteColors: null, favoriteFlowers: null, favoriteMusic: null, favoriteFood: null, favoriteDrinks: null, favoriteRestaurants: null, preferredStyle: null, dislikedElements: null },
  communicationPreference: "whatsapp",
  portalPreferences: { workspace_id: "ws_1", client_account_id: "acc_1", communication_preference: "whatsapp", email_notifications_enabled: true, sms_notifications_enabled: false, theme: "system", timezone: null },
};

describe("ClientPortalSettingsView", () => {
  it("renders the current theme and notification toggles", async () => {
    vi.mocked(getClientPortalProfileAction).mockResolvedValue({ success: true, data: PROFILE } as never);
    render(<ClientPortalSettingsView />);
    await waitFor(() => expect(screen.getByText("Theme")).toBeInTheDocument());
    expect(screen.getByLabelText("Email notifications")).toBeChecked();
    expect(screen.getByLabelText("SMS notifications")).not.toBeChecked();
  });

  it("saves a theme change through updateClientPortalPreferencesAction", async () => {
    const user = userEvent.setup();
    vi.mocked(getClientPortalProfileAction).mockResolvedValue({ success: true, data: PROFILE } as never);
    vi.mocked(updateClientPortalPreferencesAction).mockResolvedValue({ success: true, data: PROFILE.portalPreferences } as never);
    render(<ClientPortalSettingsView />);
    await waitFor(() => expect(screen.getByText("Theme")).toBeInTheDocument());

    await user.selectOptions(screen.getAllByRole("combobox")[0], "dark");
    expect(updateClientPortalPreferencesAction).toHaveBeenCalledWith({ theme: "dark" });
  });

  it("shows an error state with retry on failure", async () => {
    vi.mocked(getClientPortalProfileAction).mockResolvedValue({ success: false, error: "boom" } as never);
    render(<ClientPortalSettingsView />);
    await waitFor(() => expect(screen.getByText("Could not load your settings.")).toBeInTheDocument());
  });
});
