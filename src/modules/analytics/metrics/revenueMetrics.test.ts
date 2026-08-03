import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/data", () => ({
  getContracts: vi.fn().mockResolvedValue([]),
  getExpenses: vi.fn().mockResolvedValue([]),
  getInvoices: vi.fn(),
  getPayments: vi.fn(),
}));

import { getInvoices, getPayments } from "@/lib/data";
import { getMetric } from "@/core/analytics/metricRegistry";
import { registerRevenueMetrics } from "@/modules/analytics/metrics/revenueMetrics";
import type { MetricComputeContext } from "@/types/analytics";

// Registered once for the whole file — `registerRevenueMetrics()` is deliberately idempotent (its own module-level `registered` guard), so calling it per-test would silently no-op after the first call. Only the mocked `@/lib/data` calls are reset between tests.
registerRevenueMetrics();

const WINDOW = { start: "2026-07-01T00:00:00.000Z", end: "2026-07-15T00:00:00.000Z" };
const PREVIOUS_WINDOW = { start: "2026-06-17T00:00:00.000Z", end: "2026-07-01T00:00:00.000Z" };
const CONTEXT: MetricComputeContext = { workspaceId: "ws_1", window: WINDOW, previousWindow: PREVIOUS_WINDOW, permissions: ["finance.view"], role: "owner" };

function invoice(overrides: Record<string, unknown> = {}) {
  return { id: "inv_1", status: "sent", issue_date: "2026-07-05T00:00:00.000Z", due_date: "2026-07-20T00:00:00.000Z", total_minor: 10000, balance_minor: 10000, ...overrides };
}

function payment(overrides: Record<string, unknown> = {}) {
  return { id: "pay_1", status: "succeeded", payment_type: "deposit", transaction_date: "2026-07-05T00:00:00.000Z", amount_minor: 5000, ...overrides };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("revenue.total", () => {
  it("sums active invoice totals issued within the window, excluding voided invoices", async () => {
    vi.mocked(getInvoices).mockResolvedValue([invoice({ total_minor: 10000 }), invoice({ status: "voided", total_minor: 99999 })] as never);
    const result = await getMetric("revenue.total")!.compute(CONTEXT);
    expect(result.value).toBe(10000);
  });

  it("compares the window against the immediately preceding equal-length window", async () => {
    vi.mocked(getInvoices).mockResolvedValue([
      invoice({ total_minor: 10000, issue_date: "2026-07-05T00:00:00.000Z" }),
      invoice({ total_minor: 4000, issue_date: "2026-06-20T00:00:00.000Z" }),
    ] as never);
    const result = await getMetric("revenue.total")!.compute(CONTEXT);
    expect(result.value).toBe(10000);
    expect(result.previousValue).toBe(4000);
    expect(result.trend).toBe("up");
  });
});

describe("revenue.collected", () => {
  it("nets refunds against completed payments, never counting a pending payment", async () => {
    vi.mocked(getPayments).mockResolvedValue([
      payment({ amount_minor: 10000, payment_type: "deposit" }),
      payment({ amount_minor: 2000, payment_type: "refund" }),
      payment({ amount_minor: 99999, status: "pending" }),
    ] as never);
    const result = await getMetric("revenue.collected")!.compute(CONTEXT);
    expect(result.value).toBe(8000);
  });
});

describe("revenue.outstandingBalance", () => {
  it("is a point-in-time snapshot — never claims a period-over-period trend", async () => {
    vi.mocked(getInvoices).mockResolvedValue([invoice({ balance_minor: 5000, status: "sent" })] as never);
    vi.mocked(getPayments).mockResolvedValue([] as never);
    const result = await getMetric("revenue.outstandingBalance")!.compute(CONTEXT);
    expect(result.value).toBe(5000);
    expect(result.previousValue).toBeNull();
    expect(result.changePercent).toBeNull();
  });
});

describe("revenue.upcoming", () => {
  it("looks forward from the window's own end, using the window's own duration as the horizon", async () => {
    vi.mocked(getInvoices).mockResolvedValue([
      invoice({ status: "sent", due_date: "2026-07-20T00:00:00.000Z", balance_minor: 3000 }), // within the 14-day forward horizon from window.end
      invoice({ status: "sent", due_date: "2026-09-01T00:00:00.000Z", balance_minor: 9000 }), // outside the horizon
      invoice({ status: "paid", due_date: "2026-07-16T00:00:00.000Z", balance_minor: 1000 }), // paid, excluded
    ] as never);
    const result = await getMetric("revenue.upcoming")!.compute(CONTEXT);
    expect(result.value).toBe(3000);
  });
});
