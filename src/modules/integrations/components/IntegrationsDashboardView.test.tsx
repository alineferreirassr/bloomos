import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntegrationsDashboardView } from "@/modules/integrations/components/IntegrationsDashboardView";
import type { IntegrationsDashboardData } from "@/modules/integrations/getIntegrationsDashboardData";

vi.mock("@/modules/integrations/getIntegrationsDashboardData", () => ({
  getIntegrationsDashboardData: vi.fn(),
}));

vi.mock("@/core/commandPalette", () => ({
  registerCommand: vi.fn(),
  unregisterCommand: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { getIntegrationsDashboardData } from "@/modules/integrations/getIntegrationsDashboardData";

const READY_DATA: IntegrationsDashboardData = {
  providerCount: 20,
  health: { total: 0, healthy: 0, needsAttention: 0, byState: {} },
  connections: [],
  queueBacklog: 0,
  unresolvedConflicts: 0,
  deadLetterCount: 0,
  recentAuditLog: [],
  integrationsHealth: {
    categories: [],
    overallScore: 0,
    connectionCount: 0,
    connectedCount: 0,
    staleConnectionCount: 0,
    expiringSoonCount: 0,
    recommendations: [],
    evaluatedAt: "2026-01-01T00:00:00Z",
  },
  integrationsAnalytics: {
    connectedProviders: 0,
    activeConnections: 0,
    failedConnections: 0,
    totalSyncs: 0,
    successfulSyncs: 0,
    failedSyncs: 0,
    webhookEventsReceived: 0,
    webhookEventsFailed: 0,
    retriesTotal: 0,
    storageTransfers: 0,
    averageProcessingDurationMs: null,
    providerErrorRate: 0,
    computedAt: "2026-01-01T00:00:00Z",
  },
};

/**
 * BUG B (INTEGRATIONS-STAGING-01) — the exact regression this file exists to
 * guard against: `IntegrationsDashboardView` previously had no `.catch()` on
 * either of its two `getIntegrationsDashboardData()` call sites, so a
 * rejected Server Action promise (a live PGRST205 error, or any future
 * server-side failure) left the component permanently in its loading
 * skeleton — no error, no retry, indefinitely. Cases 4-6 below are the ones
 * that previously had zero coverage and let that ship unnoticed.
 */
describe("IntegrationsDashboardView", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows the loading skeleton before the fetch resolves", () => {
    vi.mocked(getIntegrationsDashboardData).mockReturnValue(new Promise(() => {}));
    render(<IntegrationsDashboardView />);
    expect(screen.queryByText("Integrations")).not.toBeInTheDocument();
  });

  it("renders the dashboard on a successful result", async () => {
    vi.mocked(getIntegrationsDashboardData).mockResolvedValue({ success: true, data: READY_DATA });
    render(<IntegrationsDashboardView />);
    expect(await screen.findByText("Integrations")).toBeInTheDocument();
    expect(screen.getByText("No connections yet")).toBeInTheDocument();
  });

  it("renders the controlled ErrorState on a { success: false } result", async () => {
    vi.mocked(getIntegrationsDashboardData).mockResolvedValue({ success: false, error: "The Integrations Dashboard isn't available. You may not have access to it." });
    render(<IntegrationsDashboardView />);
    expect(await screen.findByText("The Integrations Dashboard isn't available.")).toBeInTheDocument();
  });

  it("exits the skeleton and renders ErrorState when the Server Action promise rejects — never hangs forever", async () => {
    vi.mocked(getIntegrationsDashboardData).mockRejectedValue(new Error("Could not find the table 'public.integration_connections' in the schema cache"));
    render(<IntegrationsDashboardView />);

    expect(await screen.findByText("The Integrations Dashboard isn't available.")).toBeInTheDocument();
    // Never expose the raw server/Supabase error text to the browser.
    expect(screen.queryByText(/integration_connections/)).not.toBeInTheDocument();
    expect(screen.queryByText(/schema cache/)).not.toBeInTheDocument();
  });

  it("retry after a rejection calls load again and can recover", async () => {
    const user = userEvent.setup();
    vi.mocked(getIntegrationsDashboardData).mockRejectedValueOnce(new Error("network error"));
    render(<IntegrationsDashboardView />);
    await screen.findByText("The Integrations Dashboard isn't available.");

    vi.mocked(getIntegrationsDashboardData).mockResolvedValueOnce({ success: true, data: READY_DATA });
    await user.click(screen.getByRole("button", { name: /try again/i }));

    expect(await screen.findByText("Integrations")).toBeInTheDocument();
    expect(vi.mocked(getIntegrationsDashboardData)).toHaveBeenCalledTimes(2);
  });

  it("retry after a { success: false } result also recovers on success", async () => {
    const user = userEvent.setup();
    vi.mocked(getIntegrationsDashboardData).mockResolvedValueOnce({ success: false, error: "denied" });
    render(<IntegrationsDashboardView />);
    await screen.findByText("The Integrations Dashboard isn't available.");

    vi.mocked(getIntegrationsDashboardData).mockResolvedValueOnce({ success: true, data: READY_DATA });
    await user.click(screen.getByRole("button", { name: /try again/i }));

    expect(await screen.findByText("Integrations")).toBeInTheDocument();
  });
});
