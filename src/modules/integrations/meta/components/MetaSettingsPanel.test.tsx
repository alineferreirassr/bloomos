import { afterEach, describe, expect, it, vi } from "vitest";
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
}));

vi.mock("@/modules/integrations/meta/metaAccountActions", () => ({
  discoverMetaAccountsAction: vi.fn(),
  getSelectedMetaPublishingIdentityAction: vi.fn(),
  selectMetaPublishingIdentityAction: vi.fn(),
}));

import { beginProviderOAuthConnectionAction, disconnectOAuthProviderAction, getOwnProviderConnectionAction } from "@/modules/integrations/manageOAuthConnectionActions";
import { discoverMetaAccountsAction, getSelectedMetaPublishingIdentityAction, selectMetaPublishingIdentityAction } from "@/modules/integrations/meta/metaAccountActions";
import { MetaSettingsPanel } from "@/modules/integrations/meta/components/MetaSettingsPanel";
import type { IntegrationConnection } from "@/core/integrations/types";

function connection(overrides: Partial<IntegrationConnection> = {}): IntegrationConnection {
  return {
    id: "conn_meta_1",
    workspace_id: "ws_1",
    member_id: null,
    provider_id: "meta",
    state: "connected",
    config: {},
    credential_id: "cred_1",
    capabilities: ["oauth"],
    version: 1,
    installed_by: "member_1",
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

const PAGES = [
  { id: "page_1", name: "Amoré Bloom", instagramAccountId: "ig_1", instagramUsername: "amorebloom" },
  { id: "page_2", name: "Amoré Bloom Weddings", instagramAccountId: null, instagramUsername: null },
];

afterEach(() => {
  mockSearchParams = new URLSearchParams();
  vi.clearAllMocks();
});

describe("MetaSettingsPanel", () => {
  it("shows 'Not connected' and a Connect button when there is no connection yet", async () => {
    vi.mocked(getOwnProviderConnectionAction).mockResolvedValue({ success: true, data: null });
    vi.mocked(getSelectedMetaPublishingIdentityAction).mockResolvedValue({ success: true, data: null });

    render(<MetaSettingsPanel />);

    expect(await screen.findByText("Not connected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect Meta" })).toBeInTheDocument();
    expect(screen.queryByText("Facebook Pages")).not.toBeInTheDocument();
  });

  it("a successful OAuth connection alone shows a Pages-discovery state, never a fabricated 'ready' status", async () => {
    vi.mocked(getOwnProviderConnectionAction).mockResolvedValue({ success: true, data: connection() });
    vi.mocked(getSelectedMetaPublishingIdentityAction).mockResolvedValue({ success: true, data: null });
    vi.mocked(discoverMetaAccountsAction).mockResolvedValue({ success: true, data: [] });

    render(<MetaSettingsPanel />);

    expect(await screen.findByText("No eligible Facebook Page found")).toBeInTheDocument();
    expect(screen.queryByText("Instagram publishing identity available")).not.toBeInTheDocument();
  });

  it("shows 'No eligible Instagram account found' when Pages exist but none has a linked Instagram account", async () => {
    vi.mocked(getOwnProviderConnectionAction).mockResolvedValue({ success: true, data: connection() });
    vi.mocked(getSelectedMetaPublishingIdentityAction).mockResolvedValue({ success: true, data: null });
    vi.mocked(discoverMetaAccountsAction).mockResolvedValue({ success: true, data: [{ id: "page_2", name: "Amoré Bloom Weddings", instagramAccountId: null, instagramUsername: null }] });

    render(<MetaSettingsPanel />);

    expect(await screen.findByText("No eligible Instagram account found")).toBeInTheDocument();
  });

  it("shows the real discovered Pages and lets the member select one with an eligible Instagram account", async () => {
    const user = userEvent.setup();
    vi.mocked(getOwnProviderConnectionAction).mockResolvedValue({ success: true, data: connection() });
    vi.mocked(getSelectedMetaPublishingIdentityAction).mockResolvedValue({ success: true, data: null });
    vi.mocked(discoverMetaAccountsAction).mockResolvedValue({ success: true, data: PAGES });
    vi.mocked(selectMetaPublishingIdentityAction).mockResolvedValue({ success: true, data: { pageId: "page_1", pageName: "Amoré Bloom", instagramAccountId: "ig_1", instagramUsername: "amorebloom" } });

    render(<MetaSettingsPanel />);

    expect(await screen.findByText("Amoré Bloom")).toBeInTheDocument();
    expect(screen.getByText("Instagram: @amorebloom")).toBeInTheDocument();
    expect(screen.getByText("No linked Instagram professional account")).toBeInTheDocument();

    const selectButtons = screen.getAllByRole("button", { name: "Select" });
    expect(selectButtons[1]).toBeDisabled(); // page_2 has no Instagram account
    await user.click(selectButtons[0]);

    await waitFor(() => expect(selectMetaPublishingIdentityAction).toHaveBeenCalledWith({ id: "page_1" }));
  });

  it("shows the ready health state and the currently selected Page once a selection already exists", async () => {
    vi.mocked(getOwnProviderConnectionAction).mockResolvedValue({ success: true, data: connection() });
    vi.mocked(getSelectedMetaPublishingIdentityAction).mockResolvedValue({ success: true, data: { pageId: "page_1", pageName: "Amoré Bloom", instagramAccountId: "ig_1", instagramUsername: "amorebloom" } });
    vi.mocked(discoverMetaAccountsAction).mockResolvedValue({ success: true, data: PAGES });

    render(<MetaSettingsPanel />);

    expect(await screen.findByText("Instagram publishing identity available")).toBeInTheDocument();
    expect(screen.getByText("Selected")).toBeInTheDocument();
  });

  it("shows Reconnect required, never a raw provider error, when discovery reports an auth failure", async () => {
    vi.mocked(getOwnProviderConnectionAction).mockResolvedValue({ success: true, data: connection() });
    vi.mocked(getSelectedMetaPublishingIdentityAction).mockResolvedValue({ success: true, data: null });
    vi.mocked(discoverMetaAccountsAction).mockResolvedValue({ success: false, error: "Meta rejected this connection — reconnect Meta to continue." });

    render(<MetaSettingsPanel />);

    expect(await screen.findByText("Reconnect required")).toBeInTheDocument();
  });

  it("begins a real OAuth redirect on Connect", async () => {
    const user = userEvent.setup();
    vi.mocked(getOwnProviderConnectionAction).mockResolvedValue({ success: true, data: null });
    vi.mocked(getSelectedMetaPublishingIdentityAction).mockResolvedValue({ success: true, data: null });
    vi.mocked(beginProviderOAuthConnectionAction).mockResolvedValue({ success: true, data: { authorizationUrl: "https://www.facebook.com/v26.0/dialog/oauth?client_id=abc", state: "xyz" } });

    render(<MetaSettingsPanel />);
    await screen.findByRole("button", { name: "Connect Meta" });
    await user.click(screen.getByRole("button", { name: "Connect Meta" }));

    await waitFor(() => expect(beginProviderOAuthConnectionAction).toHaveBeenCalledWith("meta", expect.stringContaining("/api/integrations/oauth/callback")));
  });

  it("disconnects and reloads the panel to a not-connected state", async () => {
    const user = userEvent.setup();
    vi.mocked(getOwnProviderConnectionAction).mockResolvedValueOnce({ success: true, data: connection() }).mockResolvedValueOnce({ success: true, data: connection({ state: "disconnected" }) });
    vi.mocked(getSelectedMetaPublishingIdentityAction).mockResolvedValue({ success: true, data: null });
    vi.mocked(discoverMetaAccountsAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(disconnectOAuthProviderAction).mockResolvedValue({ success: true, data: connection({ state: "disconnected" }) });

    render(<MetaSettingsPanel />);
    await screen.findByRole("button", { name: "Disconnect" });
    await user.click(screen.getByRole("button", { name: "Disconnect" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Connect Meta" })).toBeInTheDocument());
  });

  it("shows a one-time success message from the OAuth callback query params", async () => {
    mockSearchParams = new URLSearchParams({ integration_status: "connected", integration_detail: "meta" });
    vi.mocked(getOwnProviderConnectionAction).mockResolvedValue({ success: true, data: connection() });
    vi.mocked(getSelectedMetaPublishingIdentityAction).mockResolvedValue({ success: true, data: null });
    vi.mocked(discoverMetaAccountsAction).mockResolvedValue({ success: true, data: [] });

    render(<MetaSettingsPanel />);

    expect(await screen.findByText("Meta connected.")).toBeInTheDocument();
  });
});
