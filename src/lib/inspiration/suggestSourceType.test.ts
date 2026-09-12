import { describe, expect, it } from "vitest";
import { suggestSourceTypeFromUrl } from "@/lib/inspiration/suggestSourceType";

describe("suggestSourceTypeFromUrl", () => {
  it("suggests instagram for an instagram.com URL", () => {
    expect(suggestSourceTypeFromUrl("https://instagram.com/reel/abc")).toBe("instagram");
    expect(suggestSourceTypeFromUrl("https://www.instagram.com/reel/abc")).toBe("instagram");
  });

  it("suggests tiktok for a tiktok.com URL", () => {
    expect(suggestSourceTypeFromUrl("https://www.tiktok.com/@user/video/123")).toBe("tiktok");
  });

  it("suggests youtube for youtube.com and youtu.be URLs", () => {
    expect(suggestSourceTypeFromUrl("https://www.youtube.com/watch?v=abc")).toBe("youtube");
    expect(suggestSourceTypeFromUrl("https://youtu.be/abc")).toBe("youtube");
  });

  it("suggests pinterest for pinterest.com and pin.it URLs", () => {
    expect(suggestSourceTypeFromUrl("https://www.pinterest.com/pin/123")).toBe("pinterest");
    expect(suggestSourceTypeFromUrl("https://pin.it/abc")).toBe("pinterest");
  });

  it("returns null for an unrecognized hostname — never guesses website/other", () => {
    expect(suggestSourceTypeFromUrl("https://example.com/article")).toBeNull();
  });

  it("returns null for a malformed URL", () => {
    expect(suggestSourceTypeFromUrl("not a url")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(suggestSourceTypeFromUrl("")).toBeNull();
  });

  it("does not false-positive on a hostname that merely contains a platform name as a substring", () => {
    expect(suggestSourceTypeFromUrl("https://notpinterest.example.com/page")).toBeNull();
    expect(suggestSourceTypeFromUrl("https://myinstagram.example.com/page")).toBeNull();
  });
});
