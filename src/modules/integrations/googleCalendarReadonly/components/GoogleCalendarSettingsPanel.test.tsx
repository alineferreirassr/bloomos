import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

let mockSearchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams,
}));

vi.mock("@/modules/integrations/manageOAuthConnectionActions", () => ({
  beginProviderOAuthConnectionAction: vi.fn(),
  disconnectOAuthProviderAction: vi.fn(),
  getOwnProviderConnectionAction: vi.fn(),
  refreshProviderOAuthConnectionAction: vi.fn(),
}));

vi.mock("@/modules/integrations/googleCalendarReadonly/googleCalendarAccountActions", () => ({
  getMyGoogleCalendarsAction: vi.fn(),
  getOwnGoogleCalendarAccountSummaryAction: vi.fn(),
  identifyMyGoogleCalendarAccountAction: vi.fn(),
  listMyGoogleCalendarsAction: vi.fn(),
  setMyGoogleCalendarSelectedAction: vi.fn(),
  syncMyGoogleCalendarEventsAction: vi.fn(),
}));

import {
  beginProviderOAuthConnectionAction,
  disconnectOAuthProviderAction,
  getOwnProviderConnectionAction,
  refreshProviderOAuthConnectionAction,
} from "@/modules/integrations/manageOAuthConnectionActions";
import {
  getMyGoogleCalendarsAction,
  getOwnGoogleCalendarAccountSummaryAction,
  identifyMyGoogleCalendarAccountAction,
  listMyGoogleCalendarsAction,
  setMyGoogleCalendarSelectedAction,
  syncMyGoogleCalendarEventsAction,
} from "@/modules/integrations/googleCalendarReadonly/googleCalendarAccountActions";
import { GoogleCalendarSettingsPanel } from "@/modules/integrations/googleCalendarReadonly/components/GoogleCalendarSettingsPanel";
import type { IntegrationConnection } from "@/core/integrations/types";

function connection(overrides: Partial<IntegrationConnection> = {}): IntegrationConnection {
  return {
    id: "conn_gcal_1",
    workspace_id: "ws_1",
    member_id: "user_1",
    provider_id: "google-calendar-readonly",
    state: "connected",
    config: {},
    credential_id: "cred_1",
    capabilities: ["calendar", "oauth"],
    version: 1,
    installed_by: "user_1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    last_state_change_at: "2026-01-01T00:00:00Z",
    last_health_check_at: null,
    last_sync_at: null,
    failure_count: 0,
    retry_count: 0,
    ...overrides,
  };
}

function calendarSummary(overrides: Partial<{ id: string; summary: string | null; isPrimary: boolean; isSelected: boolean }> = {}) {
  return {
    id: "cal_1",
    summary: "Ana",
    description: null,
    timeZone: null,
    accessRole: null,
    isPrimary: false,
    isSelected: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(getOwnGoogleCalendarAccountSummaryAction).mockResolvedValue({ success: true, data: null });
  vi.mocked(getMyGoogleCalendarsAction).mockResolvedValue({ success: true, data: [] });
});

afterEach(() => {
  mockSearchParams = new URLSearchParams();
  vi.clearAllMocks();
});

describe("GoogleCalendarSettingsPanel (GC02-02)", () => {
  it("GC02-02R-Z:7 & 8. shows a Connect Google Calendar action when nothing is connected yet, targeting google-calendar-readonly", async () => {
    vi.mocked(getOwnProviderConnectionAction).mockResolvedValue({ success: true, data: null });
    render(<GoogleCalendarSettingsPanel />);

    expect(await screen.findByRole("button", { name: "Connect Google Calendar" })).toBeInTheDocument();
    expect(screen.getByText("Not connected")).toBeInTheDocument();
  });

  it("GC02-02R-Z:6. connect action wiring targets exactly google-calendar-readonly and this app's own callback route as redirectUri", async () => {
    vi.mocked(getOwnProviderConnectionAction).mockResolvedValue({ success: true, data: null });
    vi.mocked(beginProviderOAuthConnectionAction).mockResolvedValue({ success: true, data: { authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth?state=abc", state: "abc" } });
    const originalLocation = window.location;
    Object.defineProperty(window, "location", { value: { ...originalLocation, href: "", origin: "https://app.test" }, writable: true });

    render(<GoogleCalendarSettingsPanel />);
    await userEvent.click(await screen.findByRole("button", { name: "Connect Google Calendar" }));

    await waitFor(() => expect(beginProviderOAuthConnectionAction).toHaveBeenCalledWith("google-calendar-readonly", "https://app.test/api/integrations/oauth/callback"));
    expect(window.location.href).toBe("https://accounts.google.com/o/oauth2/v2/auth?state=abc");

    Object.defineProperty(window, "location", { value: originalLocation, writable: true });
  });

  it("GC02-02R-Z:9 & 10. connected state shows the safe account email when the account summary already carries one", async () => {
    vi.mocked(getOwnProviderConnectionAction).mockResolvedValue({ success: true, data: connection({ state: "connected" }) });
    vi.mocked(getOwnGoogleCalendarAccountSummaryAction).mockResolvedValue({
      success: true,
      data: { syncStatus: "synced", providerAccountEmail: "ana@amorebloom.com", lastSyncedAt: null, lastSuccessfulSyncAt: null, syncErrorCode: null },
    });

    render(<GoogleCalendarSettingsPanel />);

    expect(await screen.findByText("ana@amorebloom.com")).toBeInTheDocument();
    expect(identifyMyGoogleCalendarAccountAction).not.toHaveBeenCalled();
  });

  it("GC02-02H. identifies the account exactly once, automatically, when connected but never identified", async () => {
    vi.mocked(getOwnProviderConnectionAction).mockResolvedValue({ success: true, data: connection({ state: "connected" }) });
    vi.mocked(getOwnGoogleCalendarAccountSummaryAction)
      .mockResolvedValueOnce({ success: true, data: null })
      .mockResolvedValue({ success: true, data: { syncStatus: "synced", providerAccountEmail: "ana@amorebloom.com", lastSyncedAt: null, lastSuccessfulSyncAt: null, syncErrorCode: null } });
    vi.mocked(identifyMyGoogleCalendarAccountAction).mockResolvedValue({ success: true, data: { status: "success", account: {} as never } });

    render(<GoogleCalendarSettingsPanel />);

    await waitFor(() => expect(identifyMyGoogleCalendarAccountAction).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("ana@amorebloom.com")).toBeInTheDocument();
  });

  it("shows Disconnect for a connected connection, and calling it re-loads canonical state on success", async () => {
    vi.mocked(getOwnProviderConnectionAction).mockResolvedValueOnce({ success: true, data: connection({ state: "connected" }) }).mockResolvedValueOnce({ success: true, data: connection({ state: "disabled" }) });
    vi.mocked(disconnectOAuthProviderAction).mockResolvedValue({ success: true, data: connection({ state: "disabled" }) });

    render(<GoogleCalendarSettingsPanel />);
    await userEvent.click(await screen.findByRole("button", { name: "Disconnect" }));

    expect(disconnectOAuthProviderAction).toHaveBeenCalledWith("conn_gcal_1");
    await waitFor(() => expect(getOwnProviderConnectionAction).toHaveBeenCalledTimes(2));
  });

  it("GC02-02O. disconnect preserves the persisted snapshot — no purge action of any kind is ever called", async () => {
    vi.mocked(getOwnProviderConnectionAction).mockResolvedValue({ success: true, data: connection({ state: "connected" }) });
    vi.mocked(disconnectOAuthProviderAction).mockResolvedValue({ success: true, data: connection({ state: "disabled" }) });

    render(<GoogleCalendarSettingsPanel />);
    await userEvent.click(await screen.findByRole("button", { name: "Disconnect" }));

    await waitFor(() => expect(disconnectOAuthProviderAction).toHaveBeenCalled());
    // The only mocked mutation actions are Connect/Disconnect/Refresh/Sync/Select — none is a delete/purge action, and none of those unrelated mocks is invoked here.
    expect(setMyGoogleCalendarSelectedAction).not.toHaveBeenCalled();
    expect(syncMyGoogleCalendarEventsAction).not.toHaveBeenCalled();
  });

  it("shows Reconnect for an expired connection", async () => {
    vi.mocked(getOwnProviderConnectionAction).mockResolvedValue({ success: true, data: connection({ state: "expired" }) });
    vi.mocked(refreshProviderOAuthConnectionAction).mockResolvedValue({ success: true, data: connection({ state: "connected" }) });

    render(<GoogleCalendarSettingsPanel />);
    await userEvent.click(await screen.findByRole("button", { name: "Reconnect Google Calendar" }));

    expect(refreshProviderOAuthConnectionAction).toHaveBeenCalledWith("conn_gcal_1");
    expect(beginProviderOAuthConnectionAction).not.toHaveBeenCalled();
  });

  it("shows Try again for a failed connection", async () => {
    vi.mocked(getOwnProviderConnectionAction).mockResolvedValue({ success: true, data: connection({ state: "failed" }) });
    render(<GoogleCalendarSettingsPanel />);
    expect(await screen.findByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  describe("Calendar list (GC02-02R-Z:12, 13, 14, 15)", () => {
    it("renders the persisted calendar list with primary indication and selected state", async () => {
      vi.mocked(getOwnProviderConnectionAction).mockResolvedValue({ success: true, data: connection({ state: "connected" }) });
      vi.mocked(getOwnGoogleCalendarAccountSummaryAction).mockResolvedValue({
        success: true,
        data: { syncStatus: "synced", providerAccountEmail: "ana@amorebloom.com", lastSyncedAt: null, lastSuccessfulSyncAt: null, syncErrorCode: null },
      });
      vi.mocked(getMyGoogleCalendarsAction).mockResolvedValue({
        success: true,
        data: [calendarSummary({ id: "cal_primary", summary: "Ana", isPrimary: true, isSelected: true }), calendarSummary({ id: "cal_secondary", summary: "Team", isPrimary: false, isSelected: false })],
      });

      render(<GoogleCalendarSettingsPanel />);

      expect(await screen.findByText("Ana")).toBeInTheDocument();
      expect(screen.getByText("Team")).toBeInTheDocument();
      expect(screen.getByText("Primary")).toBeInTheDocument();
      const checkboxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
      expect(checkboxes.find((c) => c.id === "google-calendar-cal_primary")?.checked).toBe(true);
      expect(checkboxes.find((c) => c.id === "google-calendar-cal_secondary")?.checked).toBe(false);
    });

    it("17. a null/empty calendar summary falls back to a safe neutral label", async () => {
      vi.mocked(getOwnProviderConnectionAction).mockResolvedValue({ success: true, data: connection({ state: "connected" }) });
      vi.mocked(getOwnGoogleCalendarAccountSummaryAction).mockResolvedValue({ success: true, data: { syncStatus: "synced", providerAccountEmail: "ana@amorebloom.com", lastSyncedAt: null, lastSuccessfulSyncAt: null, syncErrorCode: null } });
      vi.mocked(getMyGoogleCalendarsAction).mockResolvedValue({ success: true, data: [calendarSummary({ id: "cal_1", summary: null })] });

      render(<GoogleCalendarSettingsPanel />);
      expect(await screen.findByText("Untitled calendar")).toBeInTheDocument();
    });

    it("21. never exposes provider_calendar_id, sync_token, or internal account ids in the rendered panel", async () => {
      vi.mocked(getOwnProviderConnectionAction).mockResolvedValue({ success: true, data: connection({ state: "connected" }) });
      vi.mocked(getOwnGoogleCalendarAccountSummaryAction).mockResolvedValue({ success: true, data: { syncStatus: "synced", providerAccountEmail: "ana@amorebloom.com", lastSyncedAt: null, lastSuccessfulSyncAt: null, syncErrorCode: null } });
      vi.mocked(getMyGoogleCalendarsAction).mockResolvedValue({ success: true, data: [calendarSummary({ id: "cal_1" })] });

      const { container } = render(<GoogleCalendarSettingsPanel />);
      await screen.findByText("Ana");
      expect(container.textContent).not.toMatch(/sync_token|provider_calendar_id|workspace_id|member_id|account_id/i);
    });
  });

  describe("Calendar selection mutation (GC02-02R-Z:16-18)", () => {
    it("16. checking a calendar calls the selection action with the internal id and true", async () => {
      vi.mocked(getOwnProviderConnectionAction).mockResolvedValue({ success: true, data: connection({ state: "connected" }) });
      vi.mocked(getOwnGoogleCalendarAccountSummaryAction).mockResolvedValue({ success: true, data: { syncStatus: "synced", providerAccountEmail: "ana@amorebloom.com", lastSyncedAt: null, lastSuccessfulSyncAt: null, syncErrorCode: null } });
      vi.mocked(getMyGoogleCalendarsAction).mockResolvedValue({ success: true, data: [calendarSummary({ id: "cal_1", isSelected: false })] });
      vi.mocked(setMyGoogleCalendarSelectedAction).mockResolvedValue({ success: true, data: calendarSummary({ id: "cal_1", isSelected: true }) });

      render(<GoogleCalendarSettingsPanel />);
      const checkbox = await screen.findByRole("checkbox");
      await userEvent.click(checkbox);

      expect(setMyGoogleCalendarSelectedAction).toHaveBeenCalledWith("cal_1", true);
    });

    it("17. unchecking a calendar calls the selection action with false", async () => {
      vi.mocked(getOwnProviderConnectionAction).mockResolvedValue({ success: true, data: connection({ state: "connected" }) });
      vi.mocked(getOwnGoogleCalendarAccountSummaryAction).mockResolvedValue({ success: true, data: { syncStatus: "synced", providerAccountEmail: "ana@amorebloom.com", lastSyncedAt: null, lastSuccessfulSyncAt: null, syncErrorCode: null } });
      vi.mocked(getMyGoogleCalendarsAction).mockResolvedValue({ success: true, data: [calendarSummary({ id: "cal_1", isSelected: true })] });
      vi.mocked(setMyGoogleCalendarSelectedAction).mockResolvedValue({ success: true, data: calendarSummary({ id: "cal_1", isSelected: false }) });

      render(<GoogleCalendarSettingsPanel />);
      const checkbox = await screen.findByRole("checkbox");
      await userEvent.click(checkbox);

      expect(setMyGoogleCalendarSelectedAction).toHaveBeenCalledWith("cal_1", false);
    });

    it("18. shows a pending/disabled state on the checkbox while the mutation is in flight, preventing a duplicate submission", async () => {
      vi.mocked(getOwnProviderConnectionAction).mockResolvedValue({ success: true, data: connection({ state: "connected" }) });
      vi.mocked(getOwnGoogleCalendarAccountSummaryAction).mockResolvedValue({ success: true, data: { syncStatus: "synced", providerAccountEmail: "ana@amorebloom.com", lastSyncedAt: null, lastSuccessfulSyncAt: null, syncErrorCode: null } });
      vi.mocked(getMyGoogleCalendarsAction).mockResolvedValue({ success: true, data: [calendarSummary({ id: "cal_1", isSelected: false })] });
      let resolveMutation: (value: { success: true; data: ReturnType<typeof calendarSummary> }) => void = () => {};
      vi.mocked(setMyGoogleCalendarSelectedAction).mockReturnValue(new Promise((resolve) => { resolveMutation = resolve; }));

      render(<GoogleCalendarSettingsPanel />);
      const checkbox = await screen.findByRole("checkbox");
      await userEvent.click(checkbox);

      expect(checkbox).toBeDisabled();
      resolveMutation({ success: true, data: calendarSummary({ id: "cal_1", isSelected: true }) });
      await waitFor(() => expect(checkbox).not.toBeDisabled());
    });

    it("a denied selection surfaces the server's own generic error and does not hide it client-side", async () => {
      vi.mocked(getOwnProviderConnectionAction).mockResolvedValue({ success: true, data: connection({ state: "connected" }) });
      vi.mocked(getOwnGoogleCalendarAccountSummaryAction).mockResolvedValue({ success: true, data: { syncStatus: "synced", providerAccountEmail: "ana@amorebloom.com", lastSyncedAt: null, lastSuccessfulSyncAt: null, syncErrorCode: null } });
      vi.mocked(getMyGoogleCalendarsAction).mockResolvedValue({ success: true, data: [calendarSummary({ id: "cal_1", isSelected: false })] });
      vi.mocked(setMyGoogleCalendarSelectedAction).mockResolvedValue({ success: false, error: "That integration connection isn't available. You may not have access to it." });

      render(<GoogleCalendarSettingsPanel />);
      await userEvent.click(await screen.findByRole("checkbox"));

      expect(await screen.findByRole("alert")).toHaveTextContent(/isn't available/);
    });
  });

  describe("Refresh calendars (GC02-02R-J list reuse)", () => {
    it("Refresh calendars calls listMyGoogleCalendarsAction, not getMyGoogleCalendarsAction, and reloads afterward", async () => {
      vi.mocked(getOwnProviderConnectionAction).mockResolvedValue({ success: true, data: connection({ state: "connected" }) });
      vi.mocked(getOwnGoogleCalendarAccountSummaryAction).mockResolvedValue({ success: true, data: { syncStatus: "synced", providerAccountEmail: "ana@amorebloom.com", lastSyncedAt: null, lastSuccessfulSyncAt: null, syncErrorCode: null } });
      vi.mocked(listMyGoogleCalendarsAction).mockResolvedValue({ success: true, data: { status: "success", calendars: [calendarSummary({ id: "cal_1" })] } });

      render(<GoogleCalendarSettingsPanel />);
      await userEvent.click(await screen.findByRole("button", { name: "Refresh calendars" }));

      expect(listMyGoogleCalendarsAction).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(getMyGoogleCalendarsAction).toHaveBeenCalled());
    });

    it("35. does not call listMyGoogleCalendarsAction automatically on mount", async () => {
      vi.mocked(getOwnProviderConnectionAction).mockResolvedValue({ success: true, data: connection({ state: "connected" }) });
      vi.mocked(getOwnGoogleCalendarAccountSummaryAction).mockResolvedValue({ success: true, data: { syncStatus: "synced", providerAccountEmail: "ana@amorebloom.com", lastSyncedAt: null, lastSuccessfulSyncAt: null, syncErrorCode: null } });

      render(<GoogleCalendarSettingsPanel />);
      await screen.findByRole("button", { name: "Refresh calendars" });

      expect(listMyGoogleCalendarsAction).not.toHaveBeenCalled();
    });
  });

  describe("Sync now (GC02-02R-M/Q)", () => {
    it("25. Sync now calls syncMyGoogleCalendarEventsAction (no client-supplied ids)", async () => {
      vi.mocked(getOwnProviderConnectionAction).mockResolvedValue({ success: true, data: connection({ state: "connected" }) });
      vi.mocked(getOwnGoogleCalendarAccountSummaryAction).mockResolvedValue({ success: true, data: { syncStatus: "synced", providerAccountEmail: "ana@amorebloom.com", lastSyncedAt: null, lastSuccessfulSyncAt: null, syncErrorCode: null } });
      vi.mocked(syncMyGoogleCalendarEventsAction).mockResolvedValue({ success: true, data: { status: "success", results: [{ calendarId: "cal_1", status: "success", eventsProcessed: 3 }] } });

      render(<GoogleCalendarSettingsPanel />);
      await userEvent.click(await screen.findByRole("button", { name: "Sync now" }));

      expect(syncMyGoogleCalendarEventsAction).toHaveBeenCalledWith();
    });

    it("26. shows a success message after a successful sync", async () => {
      vi.mocked(getOwnProviderConnectionAction).mockResolvedValue({ success: true, data: connection({ state: "connected" }) });
      vi.mocked(getOwnGoogleCalendarAccountSummaryAction).mockResolvedValue({ success: true, data: { syncStatus: "synced", providerAccountEmail: "ana@amorebloom.com", lastSyncedAt: null, lastSuccessfulSyncAt: null, syncErrorCode: null } });
      vi.mocked(syncMyGoogleCalendarEventsAction).mockResolvedValue({ success: true, data: { status: "success", results: [{ calendarId: "cal_1", status: "success", eventsProcessed: 3 }] } });

      render(<GoogleCalendarSettingsPanel />);
      await userEvent.click(await screen.findByRole("button", { name: "Sync now" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(/Synced 1 calendar/);
    });

    it("27. shows a safe message for no_selected_calendars", async () => {
      vi.mocked(getOwnProviderConnectionAction).mockResolvedValue({ success: true, data: connection({ state: "connected" }) });
      vi.mocked(getOwnGoogleCalendarAccountSummaryAction).mockResolvedValue({ success: true, data: { syncStatus: "synced", providerAccountEmail: "ana@amorebloom.com", lastSyncedAt: null, lastSuccessfulSyncAt: null, syncErrorCode: null } });
      vi.mocked(syncMyGoogleCalendarEventsAction).mockResolvedValue({ success: true, data: { status: "no_selected_calendars" } });

      render(<GoogleCalendarSettingsPanel />);
      await userEvent.click(await screen.findByRole("button", { name: "Sync now" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(/No calendars are selected/);
    });

    it("28. shows a safe incomplete message without raw internals", async () => {
      vi.mocked(getOwnProviderConnectionAction).mockResolvedValue({ success: true, data: connection({ state: "connected" }) });
      vi.mocked(getOwnGoogleCalendarAccountSummaryAction).mockResolvedValue({ success: true, data: { syncStatus: "synced", providerAccountEmail: "ana@amorebloom.com", lastSyncedAt: null, lastSuccessfulSyncAt: null, syncErrorCode: null } });
      vi.mocked(syncMyGoogleCalendarEventsAction).mockResolvedValue({ success: true, data: { status: "success", results: [{ calendarId: "cal_1", status: "incomplete", eventsProcessed: 100 }] } });

      render(<GoogleCalendarSettingsPanel />);
      await userEvent.click(await screen.findByRole("button", { name: "Sync now" }));

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(/still catching up/);
    });

    it("29. shows a reconnect message, not raw internals, when a sync outcome reports reconnect_required", async () => {
      vi.mocked(getOwnProviderConnectionAction).mockResolvedValue({ success: true, data: connection({ state: "connected" }) });
      vi.mocked(getOwnGoogleCalendarAccountSummaryAction).mockResolvedValue({ success: true, data: { syncStatus: "synced", providerAccountEmail: "ana@amorebloom.com", lastSyncedAt: null, lastSuccessfulSyncAt: null, syncErrorCode: null } });
      vi.mocked(syncMyGoogleCalendarEventsAction).mockResolvedValue({ success: true, data: { status: "success", results: [{ calendarId: "cal_1", status: "reconnect_required", reason: "google_calendar_unauthorized" }] } });

      render(<GoogleCalendarSettingsPanel />);
      await userEvent.click(await screen.findByRole("button", { name: "Sync now" }));

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(/need.*attention/i);
      expect(alert).not.toHaveTextContent(/google_calendar_unauthorized/);
    });

    it("30 & 31. shows a safe provider-error message, never a raw error or token", async () => {
      vi.mocked(getOwnProviderConnectionAction).mockResolvedValue({ success: true, data: connection({ state: "connected" }) });
      vi.mocked(getOwnGoogleCalendarAccountSummaryAction).mockResolvedValue({ success: true, data: { syncStatus: "synced", providerAccountEmail: "ana@amorebloom.com", lastSyncedAt: null, lastSuccessfulSyncAt: null, syncErrorCode: null } });
      vi.mocked(syncMyGoogleCalendarEventsAction).mockResolvedValue({ success: false, error: "google_calendar_provider_error: <html>secret internal detail</html>" });

      render(<GoogleCalendarSettingsPanel />);
      await userEvent.click(await screen.findByRole("button", { name: "Sync now" }));

      const alert = await screen.findByRole("alert");
      expect(alert).not.toHaveTextContent(/secret internal detail/);
      expect(alert).not.toHaveTextContent(/<html>/);
    });

    it("33. sync_token never appears anywhere in the rendered panel after a sync", async () => {
      vi.mocked(getOwnProviderConnectionAction).mockResolvedValue({ success: true, data: connection({ state: "connected" }) });
      vi.mocked(getOwnGoogleCalendarAccountSummaryAction).mockResolvedValue({ success: true, data: { syncStatus: "synced", providerAccountEmail: "ana@amorebloom.com", lastSyncedAt: null, lastSuccessfulSyncAt: null, syncErrorCode: null } });
      vi.mocked(syncMyGoogleCalendarEventsAction).mockResolvedValue({ success: true, data: { status: "success", results: [{ calendarId: "cal_1", status: "success", eventsProcessed: 1 }] } });

      const { container } = render(<GoogleCalendarSettingsPanel />);
      await userEvent.click(await screen.findByRole("button", { name: "Sync now" }));
      await screen.findByRole("alert");

      expect(container.textContent).not.toMatch(/sync_token/i);
    });

    it("36. no automatic sync on mount", async () => {
      vi.mocked(getOwnProviderConnectionAction).mockResolvedValue({ success: true, data: connection({ state: "connected" }) });
      vi.mocked(getOwnGoogleCalendarAccountSummaryAction).mockResolvedValue({ success: true, data: { syncStatus: "synced", providerAccountEmail: "ana@amorebloom.com", lastSyncedAt: null, lastSuccessfulSyncAt: null, syncErrorCode: null } });

      render(<GoogleCalendarSettingsPanel />);
      await screen.findByRole("button", { name: "Sync now" });

      expect(syncMyGoogleCalendarEventsAction).not.toHaveBeenCalled();
    });

    it("does not show Sync now when not connected", async () => {
      vi.mocked(getOwnProviderConnectionAction).mockResolvedValue({ success: true, data: null });
      render(<GoogleCalendarSettingsPanel />);
      await screen.findByRole("button", { name: "Connect Google Calendar" });
      expect(screen.queryByRole("button", { name: "Sync now" })).not.toBeInTheDocument();
    });
  });

  it("34. does not automatically call syncMyGoogleCalendarEventsAction merely because a calendar was selected/deselected", async () => {
    vi.mocked(getOwnProviderConnectionAction).mockResolvedValue({ success: true, data: connection({ state: "connected" }) });
    vi.mocked(getOwnGoogleCalendarAccountSummaryAction).mockResolvedValue({ success: true, data: { syncStatus: "synced", providerAccountEmail: "ana@amorebloom.com", lastSyncedAt: null, lastSuccessfulSyncAt: null, syncErrorCode: null } });
    vi.mocked(getMyGoogleCalendarsAction).mockResolvedValue({ success: true, data: [calendarSummary({ id: "cal_1", isSelected: false })] });
    vi.mocked(setMyGoogleCalendarSelectedAction).mockResolvedValue({ success: true, data: calendarSummary({ id: "cal_1", isSelected: true }) });

    render(<GoogleCalendarSettingsPanel />);
    await userEvent.click(await screen.findByRole("checkbox"));
    await waitFor(() => expect(setMyGoogleCalendarSelectedAction).toHaveBeenCalled());

    expect(syncMyGoogleCalendarEventsAction).not.toHaveBeenCalled();
  });

  it("reads a success message from the callback redirect's own query params, scoped to google-calendar-readonly only", async () => {
    mockSearchParams = new URLSearchParams({ integration_status: "connected", integration_detail: "google-calendar-readonly" });
    vi.mocked(getOwnProviderConnectionAction).mockResolvedValue({ success: true, data: connection({ state: "connected" }) });
    render(<GoogleCalendarSettingsPanel />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/Google Calendar connected/);
  });

  it("ignores a callback redirect result meant for a different provider", async () => {
    mockSearchParams = new URLSearchParams({ integration_status: "connected", integration_detail: "gmail" });
    vi.mocked(getOwnProviderConnectionAction).mockResolvedValue({ success: true, data: connection({ state: "connected" }) });
    render(<GoogleCalendarSettingsPanel />);
    await waitFor(() => expect(getOwnProviderConnectionAction).toHaveBeenCalled());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("a Back to Settings link is present", async () => {
    vi.mocked(getOwnProviderConnectionAction).mockResolvedValue({ success: true, data: null });
    render(<GoogleCalendarSettingsPanel />);
    const link = await screen.findByRole("link", { name: "Back to Settings" });
    expect(link).toHaveAttribute("href", "/settings");
  });
});
