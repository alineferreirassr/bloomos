import { describe, expect, it } from "vitest";
import { mapSkillErrorToMessage } from "@/core/ai/skills/errorMapping";
import type { AIErrorCategory } from "@/core/ai/errors";

const messages = {
  contextUnavailable: "CONTEXT_UNAVAILABLE",
  provider: "PROVIDER",
  malformed: "MALFORMED",
  semantic: "SEMANTIC",
  permissionDenied: "PERMISSION_DENIED",
};

function mapCategory(category: AIErrorCategory, overrides: Partial<typeof messages> = {}) {
  return mapSkillErrorToMessage({ category, message: "generic" }, { ...messages, ...overrides });
}

describe("mapSkillErrorToMessage", () => {
  it("maps context_unavailable to the feature's contextUnavailable message", () => {
    expect(mapCategory("context_unavailable")).toBe("CONTEXT_UNAVAILABLE");
  });

  it("maps permission_denied and approval_required to permissionDenied when supplied", () => {
    expect(mapCategory("permission_denied")).toBe("PERMISSION_DENIED");
    expect(mapCategory("approval_required")).toBe("PERMISSION_DENIED");
  });

  it("falls back to provider for permission_denied when permissionDenied is omitted", () => {
    const { permissionDenied: _permissionDenied, ...withoutPermissionDenied } = messages;
    expect(mapSkillErrorToMessage({ category: "permission_denied", message: "x" }, withoutPermissionDenied)).toBe("PROVIDER");
  });

  it("maps malformed_output and schema_failure to malformed", () => {
    expect(mapCategory("malformed_output")).toBe("MALFORMED");
    expect(mapCategory("schema_failure")).toBe("MALFORMED");
  });

  it("maps semantic_failure to semantic when supplied, else malformed", () => {
    expect(mapCategory("semantic_failure")).toBe("SEMANTIC");
    const { semantic: _semantic, ...withoutSemantic } = messages;
    expect(mapSkillErrorToMessage({ category: "semantic_failure", message: "x" }, withoutSemantic)).toBe("MALFORMED");
  });

  it("maps every remaining category (invalid_request, provider_failure, timeout, unavailable_provider, fallback_exhausted) to provider", () => {
    const categories: AIErrorCategory[] = ["invalid_request", "provider_failure", "timeout", "unavailable_provider", "fallback_exhausted"];
    for (const category of categories) {
      expect(mapCategory(category)).toBe("PROVIDER");
    }
  });
});
