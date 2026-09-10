import { afterEach, describe, expect, it, vi } from "vitest";
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

import {
  beginProviderOAuthConnectionAction,
  disconnectOAuthProviderAction,
  getOwnProviderConnectionAction,
  refreshProviderOAuthConnectionAction,
} from "@/modules/integrations/manageOAuthConnectionActions";
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
});
