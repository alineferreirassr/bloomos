import { afterEach, describe, expect, it, vi } from "vitest";
import { MetaProvider, isMetaAuthError, isMetaRateLimitError } from "@/core/integrations/providers/meta/metaProvider";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("MetaProvider", () => {
  const provider = new MetaProvider("test_access_token");

  it("declares only the oauth capability — no publish/schedule/analytics capability is advertised", () => {
    expect(provider.capabilities).toEqual(["oauth"]);
  });

  it("ping() succeeds against a real /me call and reports latency", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ id: "123", name: "Amoré Bloom" }), { status: 200 })),
    );
    const result = await provider.ping();
    expect(result.ok).toBe(true);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("ping() reports failure without throwing when the access token is rejected", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: { message: "Invalid OAuth access token.", code: 190 } }), { status: 401 })),
    );
    const result = await provider.ping();
    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("listPages() resolves Pages and their linked Instagram account via one field-expanded call", async () => {
    const fetchMock = vi.fn(async (url: URL) => {
      void url;
      return new Response(
        JSON.stringify({
          data: [
            { id: "page_1", name: "Amoré Bloom", instagram_business_account: { id: "ig_1", username: "amorebloom" } },
            { id: "page_2", name: "Amoré Bloom Weddings" },
          ],
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const pages = await provider.listPages();
    expect(pages).toEqual([
      { id: "page_1", name: "Amoré Bloom", instagramAccountId: "ig_1", instagramUsername: "amorebloom" },
      { id: "page_2", name: "Amoré Bloom Weddings", instagramAccountId: null, instagramUsername: null },
    ]);

    const [url] = fetchMock.mock.calls[0] as [URL];
    expect(url.pathname).toBe("/v26.0/me/accounts");
    expect(url.searchParams.get("fields")).toBe("id,name,instagram_business_account{id,username}");
    expect(url.searchParams.get("access_token")).toBe("test_access_token");
  });

  it("listPages() returns an empty array (never throws) when the workspace has no eligible Pages", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ data: [] }), { status: 200 })),
    );
    const pages = await provider.listPages();
    expect(pages).toEqual([]);
  });

  it("throws a sanitized error (never exposing the access token) when the Graph API call fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Invalid OAuth access token.", { status: 401 })),
    );
    await expect(provider.listPages()).rejects.toThrow(/401/);
    await expect(provider.listPages()).rejects.not.toThrow(/test_access_token/);
  });
});

describe("MetaProvider — SOCIAL-03 Instagram image publishing", () => {
  const provider = new MetaProvider("test_access_token");

  it("createInstagramMediaContainer() posts image_url/caption to the container endpoint and returns the real container id", async () => {
    const fetchMock = vi.fn(async (url: URL, init?: RequestInit) => {
      void url;
      void init;
      return new Response(JSON.stringify({ id: "container_123" }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await provider.createInstagramMediaContainer("ig_1", { imageUrl: "https://signed.example.com/post.jpg", caption: "Hello Instagram" });
    expect(result).toEqual({ containerId: "container_123" });

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe("/v26.0/ig_1/media");
    expect(init.method).toBe("POST");
    expect(url.searchParams.get("image_url")).toBe("https://signed.example.com/post.jpg");
    expect(url.searchParams.get("caption")).toBe("Hello Instagram");
  });

  it("publishInstagramMedia() posts creation_id to the media_publish endpoint and returns the real published media id", async () => {
    const fetchMock = vi.fn(async (url: URL, init?: RequestInit) => {
      void url;
      void init;
      return new Response(JSON.stringify({ id: "ig_media_1" }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await provider.publishInstagramMedia("ig_1", "container_123");
    expect(result).toEqual({ mediaId: "ig_media_1" });

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe("/v26.0/ig_1/media_publish");
    expect(init.method).toBe("POST");
    expect(url.searchParams.get("creation_id")).toBe("container_123");
  });

  it("getInstagramMediaPermalink() returns the real permalink when Meta provides one", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ permalink: "https://www.instagram.com/p/abc123/" }), { status: 200 })),
    );
    const permalink = await provider.getInstagramMediaPermalink("ig_media_1");
    expect(permalink).toBe("https://www.instagram.com/p/abc123/");
  });

  it("getInstagramMediaPermalink() returns null (never throws) when Meta doesn't provide one", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({}), { status: 200 })),
    );
    const permalink = await provider.getInstagramMediaPermalink("ig_media_1");
    expect(permalink).toBeNull();
  });

  it("getInstagramMediaPermalink() returns null (never throws) when the permalink lookup itself fails — publish already succeeded by this point", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("server error", { status: 500 })),
    );
    const permalink = await provider.getInstagramMediaPermalink("ig_media_1");
    expect(permalink).toBeNull();
  });
});

describe("isMetaAuthError", () => {
  it("recognizes Meta's own OAuthException / code 190 shape as a reconnect-required condition", () => {
    expect(isMetaAuthError(new Error("Meta Graph API error 401: (#190) OAuthException — the access token could not be decrypted"))).toBe(true);
  });

  it("does not misclassify an unrelated error as an auth error", () => {
    expect(isMetaAuthError(new Error("Meta Graph API error 500: internal server error"))).toBe(false);
    expect(isMetaAuthError(new TypeError("network failure"))).toBe(false);
  });
});

describe("MetaProvider — SOCIAL-05B Instagram image-post insights", () => {
  const provider = new MetaProvider("test_access_token");

  it("getInstagramMediaInsights() requests the exact metric list and maps real total_value entries", async () => {
    const fetchMock = vi.fn(async (url: URL) => {
      void url;
      return new Response(
        JSON.stringify({
          data: [
            { name: "reach", total_value: { value: 120 } },
            { name: "likes", total_value: { value: 0 } },
            { name: "total_interactions", total_value: { value: 8 } },
          ],
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await provider.getInstagramMediaInsights("ig_media_1", ["reach", "likes", "total_interactions"]);
    expect(result).toEqual([
      { metric: "reach", value: 120 },
      { metric: "likes", value: 0 },
      { metric: "total_interactions", value: 8 },
    ]);

    const [url] = fetchMock.mock.calls[0] as [URL];
    expect(url.pathname).toBe("/v26.0/ig_media_1/insights");
    expect(url.searchParams.get("metric")).toBe("reach,likes,total_interactions");
  });

  it("never invents a 0 for a metric Meta did not return a value for", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ data: [{ name: "reach", total_value: { value: 120 } }] }), { status: 200 })),
    );

    const result = await provider.getInstagramMediaInsights("ig_media_1", ["reach", "views", "saved"]);
    expect(result).toEqual([{ metric: "reach", value: 120 }]);
    expect(result.find((entry) => entry.metric === "views")).toBeUndefined();
    expect(result.find((entry) => entry.metric === "saved")).toBeUndefined();
  });

  it("returns an empty array (never throws) when Meta returns no insights yet for a recently published post", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ data: [] }), { status: 200 })),
    );
    const result = await provider.getInstagramMediaInsights("ig_media_1", ["reach"]);
    expect(result).toEqual([]);
  });

  it("falls back to the latest values[] entry when a metric has no total_value", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ data: [{ name: "reach", values: [{ value: 10 }, { value: 42 }] }] }), { status: 200 })),
    );
    const result = await provider.getInstagramMediaInsights("ig_media_1", ["reach"]);
    expect(result).toEqual([{ metric: "reach", value: 42 }]);
  });
});

describe("isMetaRateLimitError", () => {
  it("recognizes Meta's own platform throttling codes (4, 17, 32, 341) as a rate-limit condition", () => {
    expect(isMetaRateLimitError(new Error('Meta Graph API error 400: {"error":{"message":"(#4) Application request limit reached","type":"OAuthException","code":4}}'))).toBe(true);
    expect(isMetaRateLimitError(new Error('Meta Graph API error 400: {"error":{"message":"(#32) Page request limit reached","type":"OAuthException","code":32}}'))).toBe(true);
  });

  it("recognizes Meta's Instagram-specific Business Use Case limit (80002) as a rate-limit condition", () => {
    expect(isMetaRateLimitError(new Error('Meta Graph API error 400: {"error":{"message":"Calls to this api have exceeded the rate limit.","type":"OAuthException","code":80002}}'))).toBe(true);
  });

  it("does not misclassify an unrelated error as a rate-limit error", () => {
    expect(isMetaRateLimitError(new Error("Meta Graph API error 500: internal server error"))).toBe(false);
    expect(isMetaRateLimitError(new Error("Meta Graph API error 401: (#190) OAuthException — the access token could not be decrypted"))).toBe(false);
    expect(isMetaRateLimitError(new TypeError("network failure"))).toBe(false);
  });
});
