import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/core/api/observability", () => ({
  recordApiRequest: vi.fn(),
}));
vi.mock("@/core/api/rateLimit", () => ({
  checkRateLimit: vi.fn(),
}));

import { createApiHandler, NextResponse } from "@/core/api/handler";
import { recordApiRequest } from "@/core/api/observability";
import { checkRateLimit } from "@/core/api/rateLimit";
import { ApiError } from "@/core/api/errors";
import { createApiKey, resetApiKeyStore } from "@/lib/data/core/api/apiKeyStore";

function request(): Request {
  return new Request("http://localhost/api/v1/clients");
}

async function authedRequest(scopes: import("@/types/apiScope").ApiScope[] = ["crm.read"]): Promise<Request> {
  const { secret } = await createApiKey("ws_1", "member_1", { name: "A", scopes });
  return new Request("http://localhost/api/v1/clients", { headers: { authorization: `Bearer ${secret}` } });
}

afterEach(() => {
  resetApiKeyStore();
  vi.clearAllMocks();
  vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true });
});

describe("createApiHandler", () => {
  it("returns 401 and records the request when auth fails, never calling the route handler", async () => {
    const routeHandler = vi.fn();
    const GET = createApiHandler("crm.read", routeHandler);
    const response = await GET(request() as never);
    expect(response.status).toBe(401);
    expect(routeHandler).not.toHaveBeenCalled();
    expect(recordApiRequest).toHaveBeenCalledTimes(1);
    expect(recordApiRequest).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it("returns 403 when the API Key lacks the required scope, never calling the route handler", async () => {
    const routeHandler = vi.fn();
    const GET = createApiHandler("finance.read", routeHandler);
    const response = await GET((await authedRequest(["crm.read"])) as never);
    expect(response.status).toBe(403);
    expect(routeHandler).not.toHaveBeenCalled();
    expect(recordApiRequest).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  it("returns 429 when the rate limit hook declines, never calling the route handler", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false });
    const routeHandler = vi.fn();
    const GET = createApiHandler("crm.read", routeHandler);
    const response = await GET((await authedRequest()) as never);
    expect(response.status).toBe(429);
    expect(routeHandler).not.toHaveBeenCalled();
  });

  it("calls the route handler with request/auth/params and returns its response on the success path", async () => {
    const GET = createApiHandler<{ id: string }>("crm.read", async (_request, auth, params) => {
      expect(auth.workspaceId).toBe("ws_1");
      expect(params.id).toBe("abc");
      return NextResponse.json({ data: "ok" });
    });
    const response = await GET((await authedRequest()) as never, { params: Promise.resolve({ id: "abc" }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: "ok" });
    expect(recordApiRequest).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 200 }));
  });

  it("maps a thrown ApiError to its own code and status", async () => {
    const GET = createApiHandler("crm.read", async () => {
      throw new ApiError("not_found", "No client with that id.");
    });
    const response = await GET((await authedRequest()) as never);
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body).toEqual({ error: { code: "not_found", message: "No client with that id." } });
  });

  it("maps any other thrown value to a generic internal_error, never leaking the original message", async () => {
    const GET = createApiHandler("crm.read", async () => {
      throw new Error("a secret internal stack trace detail");
    });
    const response = await GET((await authedRequest()) as never);
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe("internal_error");
    expect(JSON.stringify(body)).not.toContain("secret internal stack trace");
  });

  it("records exactly one observability entry per request across every exit path", async () => {
    const GET = createApiHandler("crm.read", async () => NextResponse.json({ data: null }));
    await GET((await authedRequest()) as never);
    expect(recordApiRequest).toHaveBeenCalledTimes(1);
  });
});
