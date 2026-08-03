import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/data", () => ({
  getClients: vi.fn(),
  getEvents: vi.fn(),
  getLeads: vi.fn(),
}));
vi.mock("@/lib/data/proposals", () => ({
  getProposalsRepository: vi.fn(),
}));

import { getClients, getEvents, getLeads } from "@/lib/data";
import { getProposalsRepository } from "@/lib/data/proposals";
import { getMetric } from "@/core/analytics/metricRegistry";
import { registerClientMetrics } from "@/modules/analytics/metrics/clientMetrics";
import type { MetricComputeContext } from "@/types/analytics";

registerClientMetrics();

const WINDOW = { start: "2026-07-01T00:00:00.000Z", end: "2026-07-15T00:00:00.000Z" };
const PREVIOUS_WINDOW = { start: "2026-06-17T00:00:00.000Z", end: "2026-07-01T00:00:00.000Z" };
const CONTEXT: MetricComputeContext = { workspaceId: "ws_1", window: WINDOW, previousWindow: PREVIOUS_WINDOW, permissions: [], role: "owner" };

const getRecentProposals = vi.fn();

afterEach(() => {
  vi.clearAllMocks();
});

describe("clients.new", () => {
  it("counts clients recorded within the window", async () => {
    vi.mocked(getClients).mockResolvedValue([
      { id: "c1", created_at: "2026-07-05T00:00:00.000Z" },
      { id: "c2", created_at: "2026-06-20T00:00:00.000Z" },
    ] as never);
    const result = await getMetric("clients.new")!.compute(CONTEXT);
    expect(result.value).toBe(1);
    expect(result.previousValue).toBe(1);
  });
});

describe("clients.conversionRate", () => {
  it("computes converted / total leads recorded in the window, as a percent", async () => {
    vi.mocked(getLeads).mockResolvedValue([
      { id: "l1", created_at: "2026-07-05T00:00:00.000Z", converted_client_id: "c1" },
      { id: "l2", created_at: "2026-07-06T00:00:00.000Z", converted_client_id: null },
      { id: "l3", created_at: "2026-07-07T00:00:00.000Z", converted_client_id: "c2" },
    ] as never);
    const result = await getMetric("clients.conversionRate")!.compute(CONTEXT);
    expect(result.value).toBeCloseTo(66.666, 2);
  });

  it("returns 0 rather than dividing by zero when no leads fall in the window", async () => {
    vi.mocked(getLeads).mockResolvedValue([] as never);
    const result = await getMetric("clients.conversionRate")!.compute(CONTEXT);
    expect(result.value).toBe(0);
  });
});

describe("clients.proposalAcceptance", () => {
  it("only counts decided proposals (accepted or rejected), ignoring drafts", async () => {
    vi.mocked(getProposalsRepository).mockReturnValue({ getRecentProposals } as never);
    getRecentProposals.mockResolvedValue([
      { id: "p1", created_at: "2026-07-05T00:00:00.000Z", status: "accepted" },
      { id: "p2", created_at: "2026-07-06T00:00:00.000Z", status: "rejected" },
      { id: "p3", created_at: "2026-07-07T00:00:00.000Z", status: "draft" },
    ]);
    const result = await getMetric("clients.proposalAcceptance")!.compute(CONTEXT);
    expect(result.value).toBe(50);
  });
});

describe("events.booked", () => {
  it("counts events recorded within the window", async () => {
    vi.mocked(getEvents).mockResolvedValue([{ id: "e1", created_at: "2026-07-05T00:00:00.000Z", event_date: null }] as never);
    const result = await getMetric("events.booked")!.compute(CONTEXT);
    expect(result.value).toBe(1);
  });
});

describe("events.upcoming", () => {
  it("counts events scheduled within the window's own forward-looking horizon", async () => {
    vi.mocked(getEvents).mockResolvedValue([
      { id: "e1", created_at: "2026-01-01T00:00:00.000Z", event_date: "2026-07-20T00:00:00.000Z" },
      { id: "e2", created_at: "2026-01-01T00:00:00.000Z", event_date: "2026-12-01T00:00:00.000Z" },
    ] as never);
    const result = await getMetric("events.upcoming")!.compute(CONTEXT);
    expect(result.value).toBe(1);
  });
});
