import { listMergeFields } from "@/core/documents/mergeFieldRegistry";
import type { MergeContext, MergeValue } from "@/types/documentPlatform";
import type { TemplateScope } from "@/core/documents/templateEngine";

/**
 * Step 4's own Merge Engine — resolves every registered Merge Field's own
 * value for a given `MergeContext`, pulling from Workspace, CRM, Finance,
 * Workflow, Automation, Memory, User, and Settings (the real resolver
 * implementations live in `modules/documentTemplates/mergeFields/`, one
 * file per domain, each calling `registerMergeResolver` for its own keys —
 * this file only owns the resolution mechanism, never a specific field's
 * own data access).
 *
 * Deterministic by construction: a resolver is a pure function of
 * `MergeContext` over already-persisted data — no resolver may call an AI
 * provider, read wall-clock time directly (see `core/time/clock.ts`'s own
 * seam for the one exception, `generated_at`), or depend on anything but
 * the real records `context` identifies. The same context resolved twice
 * in a row (with no data changed in between) always produces the same
 * `TemplateScope`.
 */
export type MergeResolver = (context: MergeContext) => Promise<MergeValue>;

const resolvers = new Map<string, MergeResolver>();

export function registerMergeResolver(key: string, resolver: MergeResolver): void {
  resolvers.set(key, resolver);
}

export function unregisterMergeResolver(key: string): void {
  resolvers.delete(key);
}

/** Test-only: restore the resolver map to empty between test cases. */
export function resetMergeResolvers(): void {
  resolvers.clear();
}

/**
 * Resolves every registered Merge Field against `context`, in parallel —
 * a field whose own resolver isn't registered (a developer error; every
 * built-in field registers both together via its own domain file)
 * resolves to `null` rather than throwing, so one broken field can never
 * take down the whole compile; the Compiler's own validation is what
 * surfaces that as a `missing_variable` issue if the field is `required`.
 */
export async function resolveMergeFields(context: MergeContext): Promise<TemplateScope> {
  const definitions = listMergeFields();
  const values = await Promise.all(
    definitions.map(async (definition) => {
      const resolver = resolvers.get(definition.key);
      if (!resolver) return null;
      return resolver(context);
    }),
  );

  const scope: TemplateScope = {};
  definitions.forEach((definition, index) => {
    scope[definition.key] = values[index];
  });
  return scope;
}
