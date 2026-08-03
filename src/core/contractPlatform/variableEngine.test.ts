import { describe, it, expect } from "vitest";
import { resolveContractVariables, substituteVariables, extractVariableKeys, type ContractVariableSourceData } from "@/core/contractPlatform/variableEngine";
import { makeVariableClient, makePricingReference } from "@/core/contractPlatform/testFixtures";

function input(overrides: Partial<ContractVariableSourceData> = {}): ContractVariableSourceData {
  return {
    client: makeVariableClient(),
    eventDate: "2026-08-15T00:00:00.000Z",
    pricingReference: makePricingReference(),
    companyName: "Amoré Bloom",
    ...overrides,
  };
}

describe("resolveContractVariables", () => {
  it("resolves all 9 named variables from real data", () => {
    const variables = resolveContractVariables(input());
    const keys = variables.map((v) => v.key);
    expect(keys).toEqual(["client_name", "event_date", "proposal_total", "deposit", "remaining_balance", "company_name", "address", "phone", "email"]);
  });

  it("resolves client_name from first_name + last_name", () => {
    const variables = resolveContractVariables(input());
    expect(variables.find((v) => v.key === "client_name")?.value).toBe("Jordan Rivera");
  });

  it("formats proposal_total as currency", () => {
    const variables = resolveContractVariables(input());
    expect(variables.find((v) => v.key === "proposal_total")?.value).toContain("650.00");
  });

  it("resolves empty strings, never fabricated values, when data is missing", () => {
    const variables = resolveContractVariables(input({ client: null, pricingReference: null }));
    expect(variables.find((v) => v.key === "client_name")?.value).toBe("");
    expect(variables.find((v) => v.key === "proposal_total")?.value).toBe("");
    expect(variables.find((v) => v.key === "email")?.value).toBe("");
  });

  it("resolves company_name from the supplied workspace name", () => {
    const variables = resolveContractVariables(input({ companyName: "Test Studio" }));
    expect(variables.find((v) => v.key === "company_name")?.value).toBe("Test Studio");
  });

  it("resolves address/phone/email from the client record", () => {
    const variables = resolveContractVariables(input({ client: makeVariableClient({ address: "42 Rose Ave", phone: "555-9999", email: "test@example.com" }) }));
    expect(variables.find((v) => v.key === "address")?.value).toBe("42 Rose Ave");
    expect(variables.find((v) => v.key === "phone")?.value).toBe("555-9999");
    expect(variables.find((v) => v.key === "email")?.value).toBe("test@example.com");
  });
});

describe("substituteVariables", () => {
  it("replaces every {{key}} occurrence with its resolved value", () => {
    const variables = resolveContractVariables(input());
    const result = substituteVariables("{{client_name}} agrees to pay {{proposal_total}}.", variables);
    expect(result).toBe("Jordan Rivera agrees to pay $650.00.");
  });

  it("leaves an unresolved key untouched rather than dropping it", () => {
    const variables = resolveContractVariables(input());
    const result = substituteVariables("See {{unknown_key}} for details.", variables);
    expect(result).toBe("See {{unknown_key}} for details.");
  });

  it("substitutes multiple occurrences of the same key", () => {
    const variables = resolveContractVariables(input());
    const result = substituteVariables("{{client_name}}, this is for {{client_name}}.", variables);
    expect(result).toBe("Jordan Rivera, this is for Jordan Rivera.");
  });

  it("returns text unchanged when it has no placeholders", () => {
    const variables = resolveContractVariables(input());
    expect(substituteVariables("No placeholders here.", variables)).toBe("No placeholders here.");
  });
});

describe("extractVariableKeys", () => {
  it("extracts every distinct {{key}} referenced in a string", () => {
    expect(extractVariableKeys("{{client_name}} owes {{deposit}} by {{event_date}}.")).toEqual(["client_name", "deposit", "event_date"]);
  });

  it("deduplicates repeated keys", () => {
    expect(extractVariableKeys("{{client_name}} and {{client_name}} again.")).toEqual(["client_name"]);
  });

  it("returns an empty array for text with no placeholders", () => {
    expect(extractVariableKeys("Plain text.")).toEqual([]);
  });
});
