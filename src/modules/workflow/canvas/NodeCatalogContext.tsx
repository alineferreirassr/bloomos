"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { WorkflowNodeSummary } from "@/modules/workflow/getWorkflowEditorData";

/**
 * `NodeRenderer` needs each node's own icon/color/name to render — but it
 * can never call `core/workflow/nodeRegistry`'s `getWorkflowNode()`
 * directly from client code: that registry is only ever populated by
 * `registerWorkflowNodes()`, which transitively imports the real Automation
 * Action files (Checkpoint 9), several of which reach `server-only`-guarded
 * modules. Importing that chain into a Client Component would trip the
 * exact same `server-only` violation this codebase has hit for every other
 * AI/Automation entry point. Instead, the Editor fetches a safe,
 * function-free `WorkflowNodeSummary[]` server-side
 * (`getWorkflowEditorData.ts`) and provides it here — `NodeRenderer` reads
 * from this Context, never from the real registry.
 */
const NodeCatalogContext = createContext<Map<string, WorkflowNodeSummary>>(new Map());

export function NodeCatalogProvider({ catalog, children }: { catalog: WorkflowNodeSummary[]; children: ReactNode }) {
  const catalogMap = useMemo(() => new Map(catalog.map((entry) => [entry.id, entry])), [catalog]);
  return <NodeCatalogContext.Provider value={catalogMap}>{children}</NodeCatalogContext.Provider>;
}

export function useNodeCatalogEntry(nodeTypeId: string): WorkflowNodeSummary | undefined {
  return useContext(NodeCatalogContext).get(nodeTypeId);
}
