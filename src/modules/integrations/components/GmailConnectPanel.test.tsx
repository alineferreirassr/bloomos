import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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

vi.mock("@/modules/integrations/gmail/syncGmailMailboxAction", () => ({
  getOwnGmailMailboxSummaryAction: vi.fn(),
  syncMyGmailMailboxAction: vi.fn(),
}));

import {
  beginProviderOAuthConnectionAction,
  disconnectOAuthProviderAction,
  getOwnProviderConnectionAction,
  refreshProviderOAuthConnectionAction,
} from "@/modules/integrations/manageOAuthConnectionActions";
import { getOwnGmailMailboxSummaryAction, syncMyGmailMailboxAction } from "@/modules/integrations/gmail/syncGmailMailboxAction";
import { GmailConnectPanel } from "@/modules/integrations/components/GmailConnectPanel";
import type { IntegrationConnection } from "@/core/integrations/types";

function connection(overrides: Partial<IntegrationConnection> = {}): IntegrationConnection {
  return {
    id: "conn_gmail_1",
    workspace_id: "ws_1",
    member_id: "user_1",
    provider_id: "gmail",
    state: "connected",
    config: {},
    credential_id: "cred_1",
    capabilities: ["communication", "oauth"],
    version: 2,
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

beforeEach(() => {
  vi.mocked(getOwnGmailMailboxSummaryAction).mockResolvedValue({ success: true, data: null });
});

afterEach(() => {
  mockSearchParams = new URLSearchParams();
  vi.clearAllMocks();
});

describe("GmailConnectPanel", () => {
  it("shows a Connect Gmail action and no account identity when nothing is connected yet", async () => {
    vi.mocked(getOwnProviderConnectionAction).mockResolvedValue({ success: true, data: null });
    render(<GmailConnectPanel />);

    expect(await screen.findByRole("button", { name: "Connect Gmail" })).toBeInTheDocument();
    expect(screen.getByText("Not connected")).toBeInTheDocument();
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
  });

  it("Connect begins the OAuth flow and navigates the browser to the real authorization URL, using this app's own callback route as redirectUri", async () => {
    vi.mocked(getOwnProviderConnectionAction).mockResolvedValue({ success: true, data: null });
    vi.mocked(beginProviderOAuthConnectionAction).mockResolvedValue({ success: true, data: { authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth?state=abc", state: "abc" } });
    const originalLocation = window.location;
    Object.defineProperty(window, "location", { value: { ...originalLocation, href: "", origin: "https://app.test" }, writable: true });

    render(<GmailConnectPanel />);
    await userEvent.click(await screen.findByRole("button", { name: "Connect Gmail" }));

    await waitFor(() => expect(beginProviderOAuthConnectionAction).toHaveBeenCalledWith("gmail", "https://app.test/api/integrations/oauth/callback"));
    expect(window.location.href).toBe("https://accounts.google.com/o/oauth2/v2/auth?state=abc");

    Object.defineProperty(window, "location", { value: originalLocation, writable: true });
  });

  it("shows Disconnect for a connected connection, and calling it re-loads canonical state on success", async () => {
    vi.mocked(getOwnProviderConnectionAction).mockResolvedValueOnce({ success: true, data: connection({ state: "connected" }) }).mockResolvedValueOnce({ success: true, data: connection({ state: "disabled" }) });
    vi.mocked(disconnectOAuthProviderAction).mockResolvedValue({ success: true, data: connection({ state: "disabled" }) });

    render(<GmailConnectPanel />);
    await userEvent.click(await screen.findByRole("button", { name: "Disconnect Gmail" }));

    expect(disconnectOAuthProviderAction).toHaveBeenCalledWith("conn_gmail_1");
    await waitFor(() => expect(getOwnProviderConnectionAction).toHaveBeenCalledTimes(2));
  });

  it("a disconnect the server denies (different member) surfaces the server's own error and does not hide it client-side", async () => {
    vi.mocked(getOwnProviderConnectionAction).mockResolvedValue({ success: true, data: connection({ state: "connected" }) });
    vi.mocked(disconnectOAuthProviderAction).mockResolvedValue({ success: false, error: "That integration connection isn't available. You may not have access to it." });

    render(<GmailConnectPanel />);
    await userEvent.click(await screen.findByRole("button", { name: "Disconnect Gmail" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/isn't available/);
  });

  it("shows Reconnect (via refresh, not a fresh Connect) for an expired connection", async () => {
    vi.mocked(getOwnProviderConnectionAction).mockResolvedValue({ success: true, data: connection({ state: "expired" }) });
    vi.mocked(refreshProviderOAuthConnectionAction).mockResolvedValue({ success: true, data: connection({ state: "connected" }) });

    render(<GmailConnectPanel />);
    await userEvent.click(await screen.findByRole("button", { name: "Reconnect Gmail" }));

    expect(refreshProviderOAuthConnectionAction).toHaveBeenCalledWith("conn_gmail_1");
    expect(beginProviderOAuthConnectionAction).not.toHaveBeenCalled();
  });

  it("shows Try again (a fresh Connect) for a failed connection", async () => {
    vi.mocked(getOwnProviderConnectionAction).mockResolvedValue({ success: true, data: connection({ state: "failed" }) });
    render(<GmailConnectPanel />);
    expect(await screen.findByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("shows a disabled Connecting state with no clickable action while a connection is mid-flow", async () => {
    vi.mocked(getOwnProviderConnectionAction).mockResolvedValue({ success: true, data: connection({ state: "connecting" }) });
    render(<GmailConnectPanel />);
    expect(await screen.findByRole("button", { name: "Connecting…" })).toBeDisabled();
  });

  it("reads a success message from the callback redirect's own query params, scoped to gmail only", async () => {
    mockSearchParams = new URLSearchParams({ integration_status: "connected", integration_detail: "gmail" });
    vi.mocked(getOwnProviderConnectionAction).mockResolvedValue({ success: true, data: connection({ state: "connected" }) });
    render(<GmailConnectPanel />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/Gmail connected/);
  });

  it("ignores a callback redirect result meant for a different provider", async () => {
    mockSearchParams = new URLSearchParams({ integration_status: "connected", integration_detail: "docusign" });
    vi.mocked(getOwnProviderConnectionAction).mockResolvedValue({ success: true, data: connection({ state: "connected" }) });
    render(<GmailConnectPanel />);
    await waitFor(() => expect(getOwnProviderConnectionAction).toHaveBeenCalled());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  describe("Sync now (GMAIL-05)", () => {
    it("shows a Sync now action and 'Never synced yet' when connected but never synced", async () => {
      vi.mocked(getOwnProviderConnectionAction).mockResolvedValue({ success: true, data: connection({ state: "connected" }) });
      render(<GmailConnectPanel />);
      expect(await screen.findByRole("button", { name: "Sync now" })).toBeInTheDocument();
      expect(screen.getByText("Never synced yet.")).toBeInTheDocument();
    });

    it("does not show Sync now when not connected", async () => {
      vi.mocked(getOwnProviderConnectionAction).mockResolvedValue({ success: true, data: null });
      render(<GmailConnectPanel />);
      await screen.findByRole("button", { name: "Connect Gmail" });
      expect(screen.queryByRole("button", { name: "Sync now" })).not.toBeInTheDocument();
    });

    it("shows the last-synced timestamp from the mailbox summary", async () => {
      vi.mocked(getOwnProviderConnectionAction).mockResolvedValue({ success: true, data: connection({ state: "connected" }) });
      vi.mocked(getOwnGmailMailboxSummaryAction).mockResolvedValue({
        success: true,
        data: { syncStatus: "synced", lastSyncedAt: "2026-01-01T12:00:00.000Z", lastSuccessfulSyncAt: "2026-01-01T12:00:00.000Z", syncErrorCode: null },
      });
      render(<GmailConnectPanel />);
      expect(await screen.findByText(/Last synced/)).toBeInTheDocument();
    });

    it("Sync now calls the manual sync action (no client-supplied ids — it takes none) and shows a success message", async () => {
      vi.mocked(getOwnProviderConnectionAction).mockResolvedValue({ success: true, data: connection({ state: "connected" }) });
      vi.mocked(syncMyGmailMailboxAction).mockResolvedValue({ success: true, data: { status: "success", syncMode: "initial", threadsProcessed: 3, messagesProcessed: 5, messagesDeleted: 0, threadsSkipped: 0, messagesSkipped: 0, syncedAt: "2026-01-01T00:00:00Z" } });

      render(<GmailConnectPanel />);
      await userEvent.click(await screen.findByRole("button", { name: "Sync now" }));

      expect(syncMyGmailMailboxAction).toHaveBeenCalledWith();
      expect(await screen.findByRole("alert")).toHaveTextContent(/Synced 3 threads/);
    });

    it("shows a reconnect message, not raw internals, when sync reports reconnect_required", async () => {
      vi.mocked(getOwnProviderConnectionAction).mockResolvedValue({ success: true, data: connection({ state: "connected" }) });
      vi.mocked(syncMyGmailMailboxAction).mockResolvedValue({ success: true, data: { status: "reconnect_required", reason: "missing_readonly_scope" } });

      render(<GmailConnectPanel />);
      await userEvent.click(await screen.findByRole("button", { name: "Sync now" }));

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(/reconnected/i);
      expect(alert).not.toHaveTextContent(/missing_readonly_scope/);
    });

    it("never renders a message list, thread list, or message body anywhere in the panel", async () => {
      vi.mocked(getOwnProviderConnectionAction).mockResolvedValue({ success: true, data: connection({ state: "connected" }) });
      vi.mocked(syncMyGmailMailboxAction).mockResolvedValue({ success: true, data: { status: "success", syncMode: "initial", threadsProcessed: 2, messagesProcessed: 4, messagesDeleted: 0, threadsSkipped: 0, messagesSkipped: 0, syncedAt: "2026-01-01T00:00:00Z" } });

      render(<GmailConnectPanel />);
      await userEvent.click(await screen.findByRole("button", { name: "Sync now" }));
      await screen.findByRole("alert");

      expect(screen.queryByRole("list")).not.toBeInTheDocument();
      expect(screen.queryByRole("article")).not.toBeInTheDocument();
    });
  });

  describe("Open Inbox link (GMAIL-07)", () => {
    it("shows an Open Inbox link to /gmail-inbox once the mailbox has actually synced", async () => {
      vi.mocked(getOwnProviderConnectionAction).mockResolvedValue({ success: true, data: connection({ state: "connected" }) });
      vi.mocked(getOwnGmailMailboxSummaryAction).mockResolvedValue({
        success: true,
        data: { syncStatus: "synced", lastSyncedAt: "2026-01-01T12:00:00.000Z", lastSuccessfulSyncAt: "2026-01-01T12:00:00.000Z", syncErrorCode: null },
      });

      render(<GmailConnectPanel />);
      const link = await screen.findByRole("link", { name: "Open Inbox" });
      expect(link).toHaveAttribute("href", "/gmail-inbox");
    });

    it("does not show Open Inbox before the mailbox has ever synced", async () => {
      vi.mocked(getOwnProviderConnectionAction).mockResolvedValue({ success: true, data: connection({ state: "connected" }) });
      render(<GmailConnectPanel />);
      await screen.findByRole("button", { name: "Sync now" });
      expect(screen.queryByRole("link", { name: "Open Inbox" })).not.toBeInTheDocument();
    });

    it("does not show Open Inbox when not connected", async () => {
      vi.mocked(getOwnProviderConnectionAction).mockResolvedValue({ success: true, data: null });
      render(<GmailConnectPanel />);
      await screen.findByRole("button", { name: "Connect Gmail" });
      expect(screen.queryByRole("link", { name: "Open Inbox" })).not.toBeInTheDocument();
    });
  });
});
