import { afterEach, describe, expect, it, vi } from "vitest";
import { recordApiRequestLog, listApiRequestLogsForWorkspace, summarizeApiUsage, resetApiUsageStore } from "@/lib/data/core/api/apiUsageStore";

afterEach(() => {
  resetApiUsageStore();
  vi.useRealTimers();
});

describe("apiUsageStore", () => {
  it("records a request and lists it back", () => {
    recordApiRequestLog({ workspace_id: "ws_1", api_key_id: "key_1", method: "GET", path: "/api/v1/clients", status_code: 200, duration_ms: 42 });
    recordApiRequestLog({ workspace_id: "ws_1", api_key_id: "key_1", method: "GET", path: "/api/v1/events", status_code: 200, duration_ms: 30 });
    const logs = listApiRequestLogsForWorkspace("ws_1");
    expect(logs.map((l) => l.path).sort()).toEqual(["/api/v1/clients", "/api/v1/events"]);
  });

  it("lists newest first — two requests a full second apart sort with the later one on top", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    recordApiRequestLog({ workspace_id: "ws_1", api_key_id: "key_1", method: "GET", path: "/api/v1/clients", status_code: 200, duration_ms: 42 });
    vi.setSystemTime(new Date("2026-01-01T00:00:01.000Z"));
    recordApiRequestLog({ workspace_id: "ws_1", api_key_id: "key_1", method: "GET", path: "/api/v1/events", status_code: 200, duration_ms: 30 });
    const logs = listApiRequestLogsForWorkspace("ws_1");
    expect(logs[0].path).toBe("/api/v1/events");
  });

  it("scopes listing strictly to one workspace", () => {
    recordApiRequestLog({ workspace_id: "ws_1", api_key_id: "key_1", method: "GET", path: "/api/v1/clients", status_code: 200, duration_ms: 10 });
    recordApiRequestLog({ workspace_id: "ws_2", api_key_id: "key_2", method: "GET", path: "/api/v1/clients", status_code: 200, duration_ms: 10 });
    expect(listApiRequestLogsForWorkspace("ws_1")).toHaveLength(1);
  });

  it("summarizeApiUsage aggregates total requests, errors, average duration, and a per-endpoint breakdown", () => {
    recordApiRequestLog({ workspace_id: "ws_1", api_key_id: "key_1", method: "GET", path: "/api/v1/clients", status_code: 200, duration_ms: 100 });
    recordApiRequestLog({ workspace_id: "ws_1", api_key_id: "key_1", method: "GET", path: "/api/v1/clients", status_code: 200, duration_ms: 200 });
    recordApiRequestLog({ workspace_id: "ws_1", api_key_id: null, method: "GET", path: "/api/v1/invoices", status_code: 401, duration_ms: 5 });

    const summary = summarizeApiUsage("ws_1");
    expect(summary.totalRequests).toBe(3);
    expect(summary.errorCount).toBe(1);
    expect(summary.averageDurationMs).toBe(Math.round((100 + 200 + 5) / 3));

    const clients = summary.byEndpoint.find((e) => e.path === "/api/v1/clients");
    expect(clients).toMatchObject({ method: "GET", count: 2, errorCount: 0 });
    const invoices = summary.byEndpoint.find((e) => e.path === "/api/v1/invoices");
    expect(invoices).toMatchObject({ method: "GET", count: 1, errorCount: 1 });
  });

  it("summarizeApiUsage returns zeroed values for a workspace with no requests, never dividing by zero", () => {
    const summary = summarizeApiUsage("ws_empty");
    expect(summary).toEqual({ totalRequests: 0, errorCount: 0, averageDurationMs: 0, byEndpoint: [] });
  });
});
