import { describe, expect, it } from "vitest";
import { getFullName } from "@/lib/personName";

describe("getFullName", () => {
  it("concatenates first and last name exactly as before, when both are present", () => {
    expect(getFullName({ first_name: "Sofia", last_name: "Marchetti" })).toBe("Sofia Marchetti");
  });

  it("SOCIAL-13C-FND — returns an empty string, never the literal word \"null\", when both names are absent", () => {
    expect(getFullName({ first_name: null, last_name: null })).toBe("");
  });

  it("SOCIAL-13C-FND — returns just the known part when only first_name is present", () => {
    expect(getFullName({ first_name: "Sofia", last_name: null })).toBe("Sofia");
  });

  it("SOCIAL-13C-FND — returns just the known part when only last_name is present", () => {
    expect(getFullName({ first_name: null, last_name: "Marchetti" })).toBe("Marchetti");
  });
});
