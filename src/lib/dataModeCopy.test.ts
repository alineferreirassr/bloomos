import { afterEach, describe, expect, it } from "vitest";
import { getDataPersistenceMessage } from "@/lib/dataModeCopy";

afterEach(() => {
  delete process.env.NEXT_PUBLIC_DATA_MODE;
});

describe("getDataPersistenceMessage", () => {
  it("explains data is temporary in mock mode (the default)", () => {
    expect(getDataPersistenceMessage()).toMatch(/temporary/i);
    expect(getDataPersistenceMessage()).toMatch(/resets on page reload/i);
  });

  it("indicates secure persistence in supabase mode", () => {
    process.env.NEXT_PUBLIC_DATA_MODE = "supabase";
    expect(getDataPersistenceMessage()).toMatch(/securely persisted/i);
    expect(getDataPersistenceMessage()).not.toMatch(/resets on page reload/i);
  });
});
