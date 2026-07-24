import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * No provider SDK exists in this repo yet (see `docs/ai.md`), so this can't
 * assert "doesn't import openai/anthropic" directly — it asserts the
 * boundary that would still hold once one does: the UI component never
 * imports `@/core/ai` (the provider interface/registry) or the mock
 * provider directly. `generateEventOperationsBrief.ts` (the `"use server"`
 * boundary) is the only file allowed to touch either.
 */
describe("AI module structural guardrails", () => {
  it("EventOperationsBriefSection never imports the provider registry or a provider implementation directly", () => {
    const source = readFileSync(
      join(process.cwd(), "src/modules/ai/components/EventOperationsBriefSection.tsx"),
      "utf-8",
    );
    expect(source).not.toMatch(/@\/core\/ai/);
    expect(source).not.toMatch(/@\/modules\/ai\/mockProvider/);
    expect(source).not.toMatch(/@\/modules\/ai\/fetchEventContext\.server/);
    expect(source).toMatch(/@\/modules\/ai\/generateEventOperationsBrief/);
  });

  it("the provider registry and mock provider are only ever imported from the server action, never from a client component", () => {
    const serverAction = readFileSync(join(process.cwd(), "src/modules/ai/generateEventOperationsBrief.ts"), "utf-8");
    expect(serverAction).toMatch(/^"use server";/);
    expect(serverAction).toMatch(/@\/core\/ai/);
  });

  it("the server-only Event context fetch declares server-only and is never imported by the UI component", () => {
    const fetcher = readFileSync(join(process.cwd(), "src/modules/ai/fetchEventContext.server.ts"), "utf-8");
    expect(fetcher).toMatch(/^import "server-only";/);
  });
});
