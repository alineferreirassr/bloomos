import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { exchangeAuthorizationCode, refreshOAuthToken, resolveOAuthClientCredentials } from "@/core/integrations/oauthTokenExchange";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
});

describe("resolveOAuthClientCredentials", () => {
  beforeEach(() => {
    delete process.env.GOOGLE_OAUTH_CLIENT_ID;
    delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  });

  it("returns null for an unrecognized provider id", () => {
    expect(resolveOAuthClientCredentials("not-a-real-provider")).toBeNull();
  });

  it("returns null when the environment has no client configured", () => {
    expect(resolveOAuthClientCredentials("google-calendar")).toBeNull();
  });

  it("returns credentials once both env vars are set", () => {
    process.env.GOOGLE_OAUTH_CLIENT_ID = "client_id";
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = "client_secret";
    expect(resolveOAuthClientCredentials("google-calendar")).toEqual({ clientId: "client_id", clientSecret: "client_secret" });
  });
});

describe("exchangeAuthorizationCode", () => {
  beforeEach(() => {
    delete process.env.GOOGLE_OAUTH_CLIENT_ID;
    delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  });

  it("honestly reports configured:false rather than fabricating a token when no OAuth client is configured", async () => {
    const result = await exchangeAuthorizationCode({ providerId: "google-calendar", tokenEndpoint: "https://oauth2.googleapis.com/token", code: "abc", redirectUri: "https://app.example.com/callback" });
    expect(result.configured).toBe(false);
  });

  it("never calls fetch when the OAuth client isn't configured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await exchangeAuthorizationCode({ providerId: "google-calendar", tokenEndpoint: "https://oauth2.googleapis.com/token", code: "abc", redirectUri: "https://app.example.com/callback" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("performs a real POST to the token endpoint once a client is configured", async () => {
    process.env.GOOGLE_OAUTH_CLIENT_ID = "client_id";
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = "client_secret";
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ access_token: "tok_123", refresh_token: "refresh_123", expires_in: 3600 }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await exchangeAuthorizationCode({ providerId: "google-calendar", tokenEndpoint: "https://oauth2.googleapis.com/token", code: "abc", redirectUri: "https://app.example.com/callback" });
    expect(result).toEqual({ configured: true, accessToken: "tok_123", refreshToken: "refresh_123", expiresInSeconds: 3600 });
    expect(fetchMock).toHaveBeenCalledWith("https://oauth2.googleapis.com/token", expect.objectContaining({ method: "POST" }));
  });

  it("throws (never fabricates a token) when the token endpoint itself rejects the exchange", async () => {
    process.env.GOOGLE_OAUTH_CLIENT_ID = "client_id";
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = "client_secret";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("invalid_grant", { status: 400 })),
    );
    await expect(exchangeAuthorizationCode({ providerId: "google-calendar", tokenEndpoint: "https://oauth2.googleapis.com/token", code: "bad", redirectUri: "https://app.example.com/callback" })).rejects.toThrow();
  });
});

describe("refreshOAuthToken", () => {
  beforeEach(() => {
    delete process.env.GOOGLE_OAUTH_CLIENT_ID;
    delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  });

  it("honestly reports configured:false when no OAuth client is configured", async () => {
    const result = await refreshOAuthToken({ providerId: "google-calendar", tokenEndpoint: "https://oauth2.googleapis.com/token", refreshToken: "refresh_123" });
    expect(result.configured).toBe(false);
  });
});
