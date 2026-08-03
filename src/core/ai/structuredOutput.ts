import type { ZodType } from "zod";
import type { AIError } from "@/core/ai/errors";

export type StructuredOutputResult<T> = { success: true; data: T } | { success: false; error: AIError };

/**
 * Stage 1+2 of Provider response → Parse → Schema validation → Semantic
 * validation → Normalized domain result. A provider's raw `content` is
 * always a string; this is the only place that string is trusted to
 * become a typed object, and only after both JSON parsing and Zod shape
 * validation succeed — never partially.
 */
export function parseStructuredOutput<T>(raw: string, schema: ZodType<T>): StructuredOutputResult<T> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { success: false, error: { category: "malformed_output", message: "The AI response could not be read." } };
  }

  const validated = schema.safeParse(parsed);
  if (!validated.success) {
    return { success: false, error: { category: "schema_failure", message: "The AI response did not match the expected shape." } };
  }

  return { success: true, data: validated.data };
}

/**
 * Stage 3 — a use case's own domain-specific check that a Zod shape alone
 * can't express (e.g. "this risk kind must match one BloomOS actually
 * detected"). Optional: a use case with nothing further to check can skip
 * this stage entirely by not calling it.
 */
export function applySemanticValidation<T>(
  parsed: T,
  validate: (value: T) => { success: true; value: T } | { success: false; error: string },
): StructuredOutputResult<T> {
  const result = validate(parsed);
  if (!result.success) {
    return { success: false, error: { category: "semantic_failure", message: result.error } };
  }
  return { success: true, data: result.value };
}
