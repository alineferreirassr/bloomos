import { describe, expect, it } from "vitest";
import { MERGE_FIELDS, MERGE_FIELD_KEYS } from "@/modules/contracts/mergeFields";

describe("MERGE_FIELDS", () => {
  it("has a unique, non-empty key for every entry", () => {
    expect(MERGE_FIELDS.length).toBeGreaterThan(0);
    for (const field of MERGE_FIELDS) {
      expect(field.key.trim().length).toBeGreaterThan(0);
      expect(field.label.trim().length).toBeGreaterThan(0);
      expect(field.description.trim().length).toBeGreaterThan(0);
    }
    expect(new Set(MERGE_FIELD_KEYS).size).toBe(MERGE_FIELD_KEYS.length);
  });

  it("includes every field explicitly named in the phase spec", () => {
    const expected = [
      "client_name",
      "partner_name",
      "event_date",
      "event_location",
      "contract_total",
      "deposit_amount",
      "remaining_balance",
      "workspace_name",
    ];
    for (const key of expected) {
      expect(MERGE_FIELD_KEYS).toContain(key);
    }
  });

  it("MERGE_FIELD_KEYS mirrors MERGE_FIELDS exactly", () => {
    expect(MERGE_FIELD_KEYS).toEqual(MERGE_FIELDS.map((f) => f.key));
  });
});
