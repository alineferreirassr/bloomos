"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { CopilotPageContextValue } from "@/core/ai/copilot/types";

interface CopilotPageContextApi {
  value: CopilotPageContextValue | null;
  setValue: (next: CopilotPageContextValue | null) => void;
}

const CopilotPageContext = createContext<CopilotPageContextApi | null>(null);

/**
 * Checkpoint 20, Step 3 — the one place the Copilot Panel reads "where is
 * the user right now." Mounted once, high in the tree (`(app)/layout.tsx`),
 * so it survives client-side navigation between pages rather than being
 * reset to null on every route change the way page-local state would be.
 * Step 19 — the context value is memoized on `value` alone (`setValue` from
 * `useState` is already referentially stable), so a page far down the tree
 * that reads only `setValue` via `useSetCopilotPageContext` never re-renders
 * just because some other page's `value` changed.
 */
export function CopilotPageContextProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<CopilotPageContextValue | null>(null);
  const api = useMemo(() => ({ value, setValue }), [value]);
  return <CopilotPageContext.Provider value={api}>{children}</CopilotPageContext.Provider>;
}

/** A stable, referentially-unchanging fallback for a caller rendered outside `CopilotPageContextProvider` (every existing test file for a page that now calls `useSetCopilotPageContext`, and any future route that doesn't mount the Copilot) — reading returns `null`, writing is a no-op, neither ever throws. Module-level (not recreated per render) so it never itself triggers the effect in `useSetCopilotPageContext` to re-run. */
const NOOP_API: CopilotPageContextApi = { value: null, setValue: () => {} };

function useCopilotPageContextApi(): CopilotPageContextApi {
  const ctx = useContext(CopilotPageContext);
  return ctx ?? NOOP_API;
}

/** Read-only access for the Copilot Panel itself. */
export function useCopilotPageContext(): CopilotPageContextValue | null {
  return useCopilotPageContextApi().value;
}

/**
 * A detail page calls this once with its own current entity/module/selection
 * so the Copilot Panel can reference it by name instead of asking the user.
 * Clears itself on unmount (navigating away) rather than leaking a stale
 * entity into a page that has none of its own — pass the same reference
 * shape every render (memoize a plain object is fine here, it's cheap) since
 * this runs the set/clear effect whenever the value's fields actually change.
 */
export function useSetCopilotPageContext(value: CopilotPageContextValue | null): void {
  const { setValue } = useCopilotPageContextApi();
  const entityType = value?.entity?.type ?? null;
  const entityId = value?.entity?.id ?? null;
  const entityLabel = value?.entity?.label ?? null;
  const pageModule = value?.module ?? null;
  const selectionKey = value?.selection?.join(",") ?? "";
  const filtersKey = value?.filters ? JSON.stringify(value.filters) : "";

  useEffect(() => {
    if (pageModule === null && entityType === null) {
      setValue(null);
      return;
    }
    setValue({
      module: pageModule,
      entity: entityType && entityId && entityLabel ? { type: entityType, id: entityId, label: entityLabel } : null,
      selection: selectionKey ? selectionKey.split(",") : undefined,
      filters: filtersKey ? (JSON.parse(filtersKey) as Record<string, string>) : undefined,
    });
    return () => setValue(null);
  }, [pageModule, entityType, entityId, entityLabel, selectionKey, filtersKey, setValue]);
}
