import { describe, expect, it } from "vitest";
import { generateWebhookSecret, displayPrefix } from "@/lib/webhooks/webhookSecret";

describe("webhookSecret", () => {
  it("generates a secret prefixed with whsec_ and unique across calls", () => {
    const a = generateWebhookSecret();
    const b = generateWebhookSecret();
    expect(a.startsWith("whsec_")).toBe(true);
    expect(a).not.toEqual(b);
  });

  it("displayPrefix returns the first 12 characters", () => {
    const secret = generateWebhookSecret();
    const prefix = displayPrefix(secret);
    expect(prefix).toHaveLength(12);
    expect(secret.startsWith(prefix)).toBe(true);
  });
});
