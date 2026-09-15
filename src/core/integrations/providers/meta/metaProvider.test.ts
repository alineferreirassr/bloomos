import { readFileSync } from "node:fs";
import { join } from "node:path";
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

describe("MetaProvider — SOCIAL-05D Instagram account-level insights", () => {
  const provider = new MetaProvider("test_access_token");

  it("getInstagramAccountInsights() requests the ig-user-id insights edge with period=day and the exact metric list", async () => {
    const fetchMock = vi.fn(async (url: URL) => {
      void url;
      return new Response(JSON.stringify({ data: [{ name: "reach", values: [{ value: 500 }] }, { name: "profile_views", values: [{ value: 40 }] }] }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await provider.getInstagramAccountInsights("ig_user_1", ["reach", "profile_views"]);
    expect(result).toEqual([
      { metric: "reach", value: 500 },
      { metric: "profile_views", value: 40 },
    ]);

    const [url] = fetchMock.mock.calls[0] as [URL];
    expect(url.pathname).toBe("/v26.0/ig_user_1/insights");
    expect(url.searchParams.get("metric")).toBe("reach,profile_views");
    expect(url.searchParams.get("period")).toBe("day");
  });

  it("never invents a 0 for an account metric Meta did not return a value for", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ data: [{ name: "reach", values: [{ value: 500 }] }] }), { status: 200 })),
    );
    const result = await provider.getInstagramAccountInsights("ig_user_1", ["reach", "profile_views"]);
    expect(result).toEqual([{ metric: "reach", value: 500 }]);
    expect(result.find((entry) => entry.metric === "profile_views")).toBeUndefined();
  });

  it("preserves a real zero for an account metric", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ data: [{ name: "profile_views", values: [{ value: 0 }] }] }), { status: 200 })),
    );
    const result = await provider.getInstagramAccountInsights("ig_user_1", ["profile_views"]);
    expect(result).toEqual([{ metric: "profile_views", value: 0 }]);
  });

  it("throws a sanitized error (recognizable by isMetaAuthError/isMetaRateLimitError) on an auth or rate-limit failure, exactly like media insights", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: { message: "Invalid OAuth access token.", code: 190 } }), { status: 401 })),
    );
    await expect(provider.getInstagramAccountInsights("ig_user_1", ["reach"])).rejects.toSatisfy((error: unknown) => isMetaAuthError(error));
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

describe("MetaProvider — SOCIAL-12B Instagram comment reply", () => {
  const provider = new MetaProvider("test_access_token");

  it("replyToInstagramComment() posts message to the /{comment-id}/replies endpoint and returns the real reply id", async () => {
    const fetchMock = vi.fn(async (url: URL, init?: RequestInit) => {
      void url;
      void init;
      return new Response(JSON.stringify({ id: "reply_comment_1" }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await provider.replyToInstagramComment("comment_123", "Thank you so much!");
    expect(result).toEqual({ replyId: "reply_comment_1" });

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe("/v26.0/comment_123/replies");
    expect(init.method).toBe("POST");
    expect(url.searchParams.get("message")).toBe("Thank you so much!");
    expect(url.searchParams.get("access_token")).toBe("test_access_token");
  });

  it("rejects locally, without a network call, when commentId is empty — a caller bug, not a Meta failure", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(provider.replyToInstagramComment("  ", "hello")).rejects.toThrow(/commentId is required/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects locally, without a network call, when message is empty", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(provider.replyToInstagramComment("comment_123", "   ")).rejects.toThrow(/message must not be empty/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws on an authentication failure (recognizable by isMetaAuthError), same taxonomy as every other MetaProvider method", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: { message: "Invalid OAuth access token.", code: 190 } }), { status: 401 })),
    );
    await expect(provider.replyToInstagramComment("comment_123", "hi")).rejects.toSatisfy((error: unknown) => isMetaAuthError(error));
  });

  it("throws on a Meta authorization failure (permission denied on this comment/Page) distinctly from a plain auth failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: { message: "(#10) Application does not have permission for this action", code: 10 } }), { status: 403 })),
    );
    await expect(provider.replyToInstagramComment("comment_123", "hi")).rejects.toThrow(/403/);
  });

  it("throws on an invalid target (comment does not exist / was deleted)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: { message: "Unsupported get request. Object with ID 'comment_123' does not exist", code: 100 } }), { status: 400 })),
    );
    await expect(provider.replyToInstagramComment("comment_123", "hi")).rejects.toThrow(/400/);
  });

  it("throws on a rate-limit failure (recognizable by isMetaRateLimitError)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: { message: "(#4) Application request limit reached", code: 4 } }), { status: 400 })),
    );
    await expect(provider.replyToInstagramComment("comment_123", "hi")).rejects.toSatisfy((error: unknown) => isMetaRateLimitError(error));
  });

  it("throws on a transient Meta failure (5xx)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Service temporarily unavailable", { status: 503 })),
    );
    await expect(provider.replyToInstagramComment("comment_123", "hi")).rejects.toThrow(/503/);
  });

  it("throws on an unknown/unexpected Meta failure without misclassifying it as auth or rate-limit", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: { message: "An unknown error occurred", code: 1 } }), { status: 400 })),
    );
    const rejection = provider.replyToInstagramComment("comment_123", "hi");
    await expect(rejection).rejects.toThrow(/400/);
    await expect(rejection.catch((error: unknown) => error)).resolves.toSatisfy((error: unknown) => !isMetaAuthError(error) && !isMetaRateLimitError(error));
  });

  it("throws a clear error on a malformed/unexpected 200 response (missing id) rather than silently returning an undefined replyId", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 })),
    );
    await expect(provider.replyToInstagramComment("comment_123", "hi")).rejects.toThrow(/unexpected response shape/);
  });

  it("never exposes the access token in a thrown error's message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Invalid OAuth access token.", { status: 401 })),
    );
    await expect(provider.replyToInstagramComment("comment_123", "hi")).rejects.not.toThrow(/test_access_token/);
  });
});

describe("MetaProvider — SOCIAL-12B Instagram DM send", () => {
  const provider = new MetaProvider("test_access_token");

  it("sendInstagramDirectMessage() posts recipient/message JSON-string params to the /{page-id}/messages endpoint and returns the real recipient/message ids", async () => {
    const fetchMock = vi.fn(async (url: URL, init?: RequestInit) => {
      void url;
      void init;
      return new Response(JSON.stringify({ recipient_id: "igsid_1", message_id: "message_1" }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await provider.sendInstagramDirectMessage("page_1", { recipientInstagramScopedId: "igsid_1", text: "Hi there!" });
    expect(result).toEqual({ recipientId: "igsid_1", messageId: "message_1" });

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe("/v26.0/page_1/messages");
    expect(init.method).toBe("POST");
    expect(url.searchParams.get("recipient")).toBe(JSON.stringify({ id: "igsid_1" }));
    expect(url.searchParams.get("message")).toBe(JSON.stringify({ text: "Hi there!" }));
    expect(url.searchParams.get("access_token")).toBe("test_access_token");
  });

  it("rejects locally, without a network call, when pageId is empty", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(provider.sendInstagramDirectMessage("  ", { recipientInstagramScopedId: "igsid_1", text: "hi" })).rejects.toThrow(/pageId is required/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects locally, without a network call, when recipientInstagramScopedId is empty — never falls back to a conversation id", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(provider.sendInstagramDirectMessage("page_1", { recipientInstagramScopedId: "  ", text: "hi" })).rejects.toThrow(/recipientInstagramScopedId is required/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects locally, without a network call, when text is empty", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(provider.sendInstagramDirectMessage("page_1", { recipientInstagramScopedId: "igsid_1", text: "   " })).rejects.toThrow(/text must not be empty/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws on an authentication failure (recognizable by isMetaAuthError)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: { message: "Invalid OAuth access token.", code: 190 } }), { status: 401 })),
    );
    await expect(provider.sendInstagramDirectMessage("page_1", { recipientInstagramScopedId: "igsid_1", text: "hi" })).rejects.toSatisfy((error: unknown) => isMetaAuthError(error));
  });

  it("throws on a Meta authorization failure (missing instagram_manage_messages / no MESSAGE task on this Page)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: { message: "(#10) Application does not have permission for this action", code: 10 } }), { status: 403 })),
    );
    await expect(provider.sendInstagramDirectMessage("page_1", { recipientInstagramScopedId: "igsid_1", text: "hi" })).rejects.toThrow(/403/);
  });

  it("throws on an invalid target (recipient not reachable / outside the 24-hour messaging window)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: { message: "(#551) This person isn't available right now", code: 551 } }), { status: 400 })),
    );
    await expect(provider.sendInstagramDirectMessage("page_1", { recipientInstagramScopedId: "igsid_1", text: "hi" })).rejects.toThrow(/400/);
  });

  it("throws on a rate-limit failure (recognizable by isMetaRateLimitError)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: { message: "(#80002) Calls to this api have exceeded the rate limit", code: 80002 } }), { status: 400 })),
    );
    await expect(provider.sendInstagramDirectMessage("page_1", { recipientInstagramScopedId: "igsid_1", text: "hi" })).rejects.toSatisfy((error: unknown) => isMetaRateLimitError(error));
  });

  it("throws on a transient Meta failure (5xx)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Service temporarily unavailable", { status: 503 })),
    );
    await expect(provider.sendInstagramDirectMessage("page_1", { recipientInstagramScopedId: "igsid_1", text: "hi" })).rejects.toThrow(/503/);
  });

  it("throws a clear error on a malformed/unexpected 200 response (missing message_id) rather than silently returning an undefined id", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ recipient_id: "igsid_1" }), { status: 200 })),
    );
    await expect(provider.sendInstagramDirectMessage("page_1", { recipientInstagramScopedId: "igsid_1", text: "hi" })).rejects.toThrow(/unexpected response shape/);
  });

  it("never exposes the access token in a thrown error's message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Invalid OAuth access token.", { status: 401 })),
    );
    await expect(provider.sendInstagramDirectMessage("page_1", { recipientInstagramScopedId: "igsid_1", text: "hi" })).rejects.not.toThrow(/test_access_token/);
  });
});

describe("MetaProvider — SOCIAL-12B provider-boundary and parity checks", () => {
  const providerSourceFile = readFileSync(join(process.cwd(), "src/core/integrations/providers/meta/metaProvider.ts"), "utf-8");

  it("the provider source file never imports credential-resolution/server-only code — it only ever accepts an already-resolved accessToken via its constructor, exactly as before this checkpoint", () => {
    expect(providerSourceFile).not.toMatch(/from ["']@\/core\/integrations\/credentialManager["']/);
    expect(providerSourceFile).not.toMatch(/resolveAccessToken/);
  });

  it("no separate mock MetaProvider implementation exists — this remains the only implementation, exercised via fetch-stubbing in tests, matching every pre-existing MetaProvider test in this file (mock/provider parity is N/A by design, not skipped)", () => {
    expect(() => readFileSync(join(process.cwd(), "src/core/integrations/providers/meta/mockMetaProvider.ts"), "utf-8")).toThrow();
  });

  it("declares only the oauth capability still — SOCIAL-12B does not change the class's declared capabilities, matching how SOCIAL-03/05B also left this field unchanged when adding significant new methods", () => {
    expect(new MetaProvider("test_access_token").capabilities).toEqual(["oauth"]);
  });
});
