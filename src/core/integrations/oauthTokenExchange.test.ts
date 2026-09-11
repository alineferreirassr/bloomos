import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { exchangeAuthorizationCode, exchangeMetaAuthorizationCode, refreshOAuthToken, resolveOAuthClientCredentials } from "@/core/integrations/oauthTokenExchange";

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

describe("exchangeMetaAuthorizationCode — SOCIAL-02", () => {
  const TOKEN_ENDPOINT = "https://graph.facebook.com/v26.0/oauth/access_token";

  beforeEach(() => {
    delete process.env.META_OAUTH_CLIENT_ID;
    delete process.env.META_OAUTH_CLIENT_SECRET;
  });

  it("honestly reports configured:false rather than fabricating a token when no Meta OAuth client is configured", async () => {
    const result = await exchangeMetaAuthorizationCode({ tokenEndpoint: TOKEN_ENDPOINT, code: "abc", redirectUri: "https://app.example.com/callback" });
    expect(result.configured).toBe(false);
  });

  it("never calls fetch when the Meta OAuth client isn't configured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await exchangeMetaAuthorizationCode({ tokenEndpoint: TOKEN_ENDPOINT, code: "abc", redirectUri: "https://app.example.com/callback" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("performs two GET calls (short-lived code exchange, then long-lived token exchange) and returns only the long-lived token", async () => {
    process.env.META_OAUTH_CLIENT_ID = "meta_client_id";
    process.env.META_OAUTH_CLIENT_SECRET = "meta_client_secret";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "short_lived_tok", token_type: "bearer", expires_in: 5400 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "long_lived_tok", token_type: "bearer", expires_in: 5184000 }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await exchangeMetaAuthorizationCode({ tokenEndpoint: TOKEN_ENDPOINT, code: "abc", redirectUri: "https://app.example.com/callback" });
    expect(result).toEqual({ configured: true, accessToken: "long_lived_tok", refreshToken: null, expiresInSeconds: 5184000 });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [firstUrl, firstInit] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(firstInit.method).toBe("GET");
    expect(firstUrl.searchParams.get("code")).toBe("abc");
    expect(firstUrl.searchParams.get("grant_type")).toBeNull();
    expect(firstUrl.searchParams.get("client_secret")).toBe("meta_client_secret");

    const [secondUrl, secondInit] = fetchMock.mock.calls[1] as [URL, RequestInit];
    expect(secondInit.method).toBe("GET");
    expect(secondUrl.searchParams.get("grant_type")).toBe("fb_exchange_token");
    expect(secondUrl.searchParams.get("fb_exchange_token")).toBe("short_lived_tok");
  });

  it("throws (never fabricates a token) when the first code-exchange call itself rejects", async () => {
    process.env.META_OAUTH_CLIENT_ID = "meta_client_id";
    process.env.META_OAUTH_CLIENT_SECRET = "meta_client_secret";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("invalid_code", { status: 400 })),
    );
    await expect(exchangeMetaAuthorizationCode({ tokenEndpoint: TOKEN_ENDPOINT, code: "bad", redirectUri: "https://app.example.com/callback" })).rejects.toThrow();
  });

  it("throws (never fabricates a token) when the second, long-lived-exchange call rejects", async () => {
    process.env.META_OAUTH_CLIENT_ID = "meta_client_id";
    process.env.META_OAUTH_CLIENT_SECRET = "meta_client_secret";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "short_lived_tok" }), { status: 200 }))
      .mockResolvedValueOnce(new Response("invalid_token", { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(exchangeMetaAuthorizationCode({ tokenEndpoint: TOKEN_ENDPOINT, code: "abc", redirectUri: "https://app.example.com/callback" })).rejects.toThrow();
  });
});
