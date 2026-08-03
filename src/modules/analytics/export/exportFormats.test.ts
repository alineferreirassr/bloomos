import { describe, expect, it } from "vitest";
import { rowsToCsv } from "@/modules/analytics/export/exportFormats";

describe("rowsToCsv", () => {
  it("joins headers and rows with CRLF, comma-separated", () => {
    expect(rowsToCsv(["Name", "Revenue"], [["Ana", 100], ["Bea", 200]])).toBe("Name,Revenue\r\nAna,100\r\nBea,200");
  });

  it("quotes and escapes a cell containing a comma, quote, or newline", () => {
    expect(rowsToCsv(["Note"], [["hello, world"]])).toBe('Note\r\n"hello, world"');
    expect(rowsToCsv(["Note"], [['she said "hi"']])).toBe('Note\r\n"she said ""hi"""');
    expect(rowsToCsv(["Note"], [["line1\nline2"]])).toBe('Note\r\n"line1\nline2"');
  });

  it("leaves plain numeric/text cells unquoted", () => {
    expect(rowsToCsv(["Amount"], [[42]])).toBe("Amount\r\n42");
  });

  it("handles an empty row set, still emitting the header", () => {
    expect(rowsToCsv(["Name"], [])).toBe("Name");
  });
});
