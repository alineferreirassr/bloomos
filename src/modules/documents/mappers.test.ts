import { describe, expect, it } from "vitest";
import {
  formatBytes,
  formatDocumentDate,
  documentDefaultFormValues,
  documentToEditMetadataFormInput,
  bytesToMbFormString,
} from "@/modules/documents/mappers";
import { makeDocument } from "@/modules/documents/testUtils";

describe("formatBytes", () => {
  it("formats sub-megabyte sizes in bytes with an en-US thousands separator", () => {
    expect(formatBytes(21_900)).toBe("21,900 B");
  });

  it("formats megabyte-and-above sizes in MB", () => {
    expect(formatBytes(2_097_152)).toBe("2.0 MB");
  });
});

describe("bytesToMbFormString", () => {
  it("converts bytes to a plain megabyte string", () => {
    expect(bytesToMbFormString(2_097_152)).toBe("2");
  });
});

describe("formatDocumentDate", () => {
  it("formats a plain date-only string", () => {
    expect(formatDocumentDate("2026-08-01")).not.toBe("—");
  });

  it("formats a full ISO timestamp by taking only the date portion", () => {
    expect(formatDocumentDate("2026-08-01T00:00:00.000Z")).not.toBe("Invalid Date");
    expect(formatDocumentDate("2026-08-01T00:00:00.000Z")).toBe(formatDocumentDate("2026-08-01"));
  });

  it("returns an em dash for null", () => {
    expect(formatDocumentDate(null)).toBe("—");
  });
});

describe("documentDefaultFormValues", () => {
  it("defaults to a workspace-owned draft with every optional field blank", () => {
    const defaults = documentDefaultFormValues();
    expect(defaults.owner_type).toBe("workspace");
    expect(defaults.category).toBe("other");
    expect(defaults.visibility).toBe("internal");
    expect(defaults.client_id).toBe("");
  });

  it("applies overrides for cross-module prefill", () => {
    const defaults = documentDefaultFormValues({ owner_type: "client", owner_id: "client_2", client_id: "client_2" });
    expect(defaults.owner_type).toBe("client");
    expect(defaults.owner_id).toBe("client_2");
    expect(defaults.client_id).toBe("client_2");
  });
});

describe("documentToEditMetadataFormInput", () => {
  it("converts null description/expires_at to empty strings", () => {
    const document = makeDocument({ description: null, expires_at: null });
    const input = documentToEditMetadataFormInput(document);
    expect(input.description).toBe("");
    expect(input.expires_at).toBe("");
  });

  it("slices a full ISO expires_at timestamp down to a date-only string", () => {
    const document = makeDocument({ expires_at: "2026-08-01T00:00:00.000Z" });
    expect(documentToEditMetadataFormInput(document).expires_at).toBe("2026-08-01");
  });
});
