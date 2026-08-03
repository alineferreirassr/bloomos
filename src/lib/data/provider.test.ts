import { afterEach, describe, expect, it } from "vitest";
import { getDataMode, selectRepository } from "@/lib/data/provider";

afterEach(() => {
  delete process.env.NEXT_PUBLIC_DATA_MODE;
});

describe("getDataMode (re-exported from lib/env)", () => {
  it("defaults to mock", () => {
    delete process.env.NEXT_PUBLIC_DATA_MODE;
    expect(getDataMode()).toBe("mock");
  });
});

describe("selectRepository", () => {
  it("selects the mock repository by default", () => {
    delete process.env.NEXT_PUBLIC_DATA_MODE;
    const result = selectRepository({ mock: "mock-repo", supabase: "supabase-repo" });
    expect(result).toBe("mock-repo");
  });

  it("selects the supabase repository when NEXT_PUBLIC_DATA_MODE=supabase", () => {
    process.env.NEXT_PUBLIC_DATA_MODE = "supabase";
    const result = selectRepository({ mock: "mock-repo", supabase: "supabase-repo" });
    expect(result).toBe("supabase-repo");
  });

  it("falls back to mock for any unrecognized data mode value", () => {
    process.env.NEXT_PUBLIC_DATA_MODE = "staging";
    const result = selectRepository({ mock: "mock-repo", supabase: "supabase-repo" });
    expect(result).toBe("mock-repo");
  });
});
