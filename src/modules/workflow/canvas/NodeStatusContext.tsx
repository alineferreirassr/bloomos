"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { WorkflowIssue, WorkflowNodeExecutionStats } from "@/types/workflow";

export interface NodeStatus {
  stats: WorkflowNodeExecutionStats | null;
  issueCount: number;
}

const EMPTY_STATUS: NodeStatus = { stats: null, issueCount: 0 };

/**
 * v2.0 Checkpoint 39 addendum (Workflow Studio) — the same "keep the real
 * data server-side, provide a safe per-node lookup client-side" shape
 * `NodeCatalogContext` already established, this time for the Canvas's own
 * status overlay (execution stats + validation issue count) instead of the
 * static node-type catalog. Keyed by real graph node id, not node type id.
 */
const NodeStatusContext = createContext<Map<string, NodeStatus>>(new Map());

export function NodeStatusProvider({ nodeExecutionStats, issues, children }: { nodeExecutionStats: Record<string, WorkflowNodeExecutionStats>; issues: WorkflowIssue[]; children: ReactNode }) {
  const statusMap = useMemo(() => {
    const map = new Map<string, NodeStatus>();
    for (const [nodeId, stats] of Object.entries(nodeExecutionStats)) {
      map.set(nodeId, { stats, issueCount: 0 });
    }
    for (const issue of issues) {
      if (!issue.nodeId) continue;
      const existing = map.get(issue.nodeId) ?? { stats: null, issueCount: 0 };
      map.set(issue.nodeId, { ...existing, issueCount: existing.issueCount + 1 });
    }
    return map;
  }, [nodeExecutionStats, issues]);

  return <NodeStatusContext.Provider value={statusMap}>{children}</NodeStatusContext.Provider>;
}

export function useNodeStatus(nodeId: string): NodeStatus {
  return useContext(NodeStatusContext).get(nodeId) ?? EMPTY_STATUS;
}
