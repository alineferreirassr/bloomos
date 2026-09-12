import { describe, expect, it } from "vitest";
import { validateInspirationSourceUrl, normalizeInspirationSourceUrl } from "@/lib/inspiration/normalizeUrl";

describe("validateInspirationSourceUrl", () => {
  it("treats null/undefined/empty/whitespace as valid — a manual reference needs no URL", () => {
    expect(validateInspirationSourceUrl(null)).toEqual({ valid: true });
    expect(validateInspirationSourceUrl(undefined)).toEqual({ valid: true });
    expect(validateInspirationSourceUrl("")).toEqual({ valid: true });
    expect(validateInspirationSourceUrl("   ")).toEqual({ valid: true });
  });

  it("accepts http and https", () => {
    expect(validateInspirationSourceUrl("http://example.com").valid).toBe(true);
    expect(validateInspirationSourceUrl("https://example.com").valid).toBe(true);
  });

  it("rejects javascript:, data:, file:, and ftp: schemes", () => {
    expect(validateInspirationSourceUrl("javascript:alert(1)").valid).toBe(false);
    expect(validateInspirationSourceUrl("data:text/html,<script>alert(1)</script>").valid).toBe(false);
    expect(validateInspirationSourceUrl("file:///etc/passwd").valid).toBe(false);
    expect(validateInspirationSourceUrl("ftp://example.com/file").valid).toBe(false);
  });

  it("rejects a malformed URL", () => {
    expect(validateInspirationSourceUrl("not a url").valid).toBe(false);
    expect(validateInspirationSourceUrl("http://").valid).toBe(false);
  });

  it("never exposes a raw parser error — only a short, founder-facing message", () => {
    const result = validateInspirationSourceUrl("javascript:alert(1)");
    expect(result.error).toBe("Only http and https links are supported.");
  });
});

describe("normalizeInspirationSourceUrl", () => {
  it("returns null for null/undefined/empty input", () => {
    expect(normalizeInspirationSourceUrl(null)).toBeNull();
    expect(normalizeInspirationSourceUrl(undefined)).toBeNull();
    expect(normalizeInspirationSourceUrl("")).toBeNull();
  });

  it("returns null for a disallowed scheme or malformed URL — never throws", () => {
    expect(normalizeInspirationSourceUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeInspirationSourceUrl("not a url")).toBeNull();
  });

  it("lowercases the hostname", () => {
    expect(normalizeInspirationSourceUrl("https://Example.COM/reel/abc")).toBe("https://example.com/reel/abc");
  });

  it("removes the fragment", () => {
    expect(normalizeInspirationSourceUrl("https://example.com/reel/abc#comments")).toBe("https://example.com/reel/abc");
  });

  it("removes a trailing slash from a non-root path", () => {
    expect(normalizeInspirationSourceUrl("https://example.com/reel/abc/")).toBe("https://example.com/reel/abc");
  });

  it("leaves the root path's own single slash untouched", () => {
    expect(normalizeInspirationSourceUrl("https://example.com/")).toBe("https://example.com/");
  });

  it("removes a single utm_source parameter", () => {
    expect(normalizeInspirationSourceUrl("https://example.com/reel/abc?utm_source=instagram")).toBe("https://example.com/reel/abc");
  });

  it("removes multiple utm_* parameters at once", () => {
    expect(normalizeInspirationSourceUrl("https://example.com/reel/abc?utm_source=ig&utm_medium=social&utm_campaign=x")).toBe("https://example.com/reel/abc");
  });

  it("removes fbclid", () => {
    expect(normalizeInspirationSourceUrl("https://example.com/reel/abc?fbclid=xyz123")).toBe("https://example.com/reel/abc");
  });

  it("removes igshid", () => {
    expect(normalizeInspirationSourceUrl("https://example.com/reel/abc?igshid=xyz123")).toBe("https://example.com/reel/abc");
  });

  it("removes si", () => {
    expect(normalizeInspirationSourceUrl("https://youtube.com/watch?v=abc123&si=xyz")).toBe("https://youtube.com/watch?v=abc123");
  });

  it("removes ref", () => {
    expect(normalizeInspirationSourceUrl("https://example.com/reel/abc?ref=share")).toBe("https://example.com/reel/abc");
  });

  it("removes ref_src", () => {
    expect(normalizeInspirationSourceUrl("https://example.com/reel/abc?ref_src=twsrc")).toBe("https://example.com/reel/abc");
  });

  it("preserves a meaningful, non-tracking query parameter", () => {
    expect(normalizeInspirationSourceUrl("https://youtube.com/watch?v=abc123")).toBe("https://youtube.com/watch?v=abc123");
  });

  it("preserves a meaningful parameter while removing tracking parameters mixed alongside it", () => {
    expect(normalizeInspirationSourceUrl("https://youtube.com/watch?v=abc123&utm_source=ig&si=xyz")).toBe("https://youtube.com/watch?v=abc123");
  });

  it("two equivalently-tracked URLs for the same real content normalize identically", () => {
    const a = normalizeInspirationSourceUrl("https://Example.com/reel/abc/?utm_source=instagram&igshid=1");
    const b = normalizeInspirationSourceUrl("https://example.com/reel/abc?fbclid=zzz&ref=share");
    expect(a).toBe(b);
    expect(a).toBe("https://example.com/reel/abc");
  });

  it("never lowercases the path — a real Instagram/TikTok content id is case-sensitive, only the hostname is safe to lowercase", () => {
    expect(normalizeInspirationSourceUrl("https://www.instagram.com/reel/C1aBcDeFgHi/?utm_source=ig")).toBe("https://www.instagram.com/reel/C1aBcDeFgHi");
  });

  it("never extracts a content id or guesses a platform-specific canonical form — normalization stays generic", () => {
    expect(normalizeInspirationSourceUrl("https://www.tiktok.com/@creator/video/1234567890123456789")).toBe("https://www.tiktok.com/@creator/video/1234567890123456789");
  });
});
