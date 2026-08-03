"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  listWorkspaceRelationshipsAction,
  getGraphStatsAction,
  getNodeRelationshipsAction,
  findShortestPathAction,
  getKnowledgeHealthAction,
  type GraphStats,
  type NodeKnowledgeData,
} from "@/modules/knowledgeGraph/knowledgeGraphActions";
import type { KnowledgeHealthReport } from "@/core/knowledge/knowledgeHealthEngine";
import { KNOWLEDGE_NODE_TYPES, RELATIONSHIP_TYPE_LABELS, RELATIONSHIP_STATUSES } from "@/types/knowledgeGraph";
import type { KnowledgeNodeRef, KnowledgeNodeType, KnowledgeRelationship, RelationshipStatus } from "@/types/knowledgeGraph";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { AssetsIcon } from "@/components/ui/icons";

function nodeLabel(node: KnowledgeNodeRef): string {
  return `${node.nodeType}:${node.nodeId}`;
}

export function KnowledgeGraphExplorerView() {
  const [stats, setStats] = useState<GraphStats | null>(null);
  const [relationships, setRelationships] = useState<KnowledgeRelationship[]>([]);
  const [health, setHealth] = useState<KnowledgeHealthReport | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<RelationshipStatus | "all">("active");

  const [inspectNodeType, setInspectNodeType] = useState<KnowledgeNodeType>("media_asset");
  const [inspectNodeId, setInspectNodeId] = useState("");
  const [inspection, setInspection] = useState<NodeKnowledgeData | null>(null);
  const [inspecting, setInspecting] = useState(false);

  const [fromType, setFromType] = useState<KnowledgeNodeType>("media_asset");
  const [fromId, setFromId] = useState("");
  const [toType, setToType] = useState<KnowledgeNodeType>("event");
  const [toId, setToId] = useState("");
  const [pathResult, setPathResult] = useState<KnowledgeNodeRef[] | null | "none">(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getGraphStatsAction(), listWorkspaceRelationshipsAction(true), getKnowledgeHealthAction()]).then(([statsResult, listResult, healthResult]) => {
      if (cancelled) return;
      if (statsResult.success) setStats(statsResult.data);
      if (listResult.success) setRelationships(listResult.data);
      if (healthResult.success) setHealth(healthResult.data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleInspect() {
    if (!inspectNodeId.trim()) return;
    setInspecting(true);
    const result = await getNodeRelationshipsAction({ nodeType: inspectNodeType, nodeId: inspectNodeId.trim() });
    if (result.success) setInspection(result.data);
    setInspecting(false);
  }

  async function handleFindPath() {
    if (!fromId.trim() || !toId.trim()) return;
    const result = await findShortestPathAction({ nodeType: fromType, nodeId: fromId.trim() }, { nodeType: toType, nodeId: toId.trim() });
    if (result.success) setPathResult(result.data ? result.data.nodes : "none");
  }

  const filteredRelationships = relationships.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (typeFilter !== "all" && r.relationship_type !== typeFilter) return false;
    return true;
  });

  return (
    <div>
      <PageHeader
        title="Knowledge Graph Explorer"
        subtitle="Every relationship BloomOS has recorded — what's connected, why, and what depends on it."
        icon={AssetsIcon}
        breadcrumb={[{ label: "Asset Library", href: "/assets" }, { label: "Knowledge Graph Explorer" }]}
        actions={
          <Link href="/assets/business-health">
            <Button variant="secondary">Business Health</Button>
          </Link>
        }
      />

      {stats ? (
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card>
            <p className="text-xs text-text-muted">Active Relationships</p>
            <p className="mt-1 text-2xl font-semibold">{stats.totalActive}</p>
          </Card>
          <Card>
            <p className="text-xs text-text-muted">Archived</p>
            <p className="mt-1 text-2xl font-semibold">{stats.totalArchived}</p>
          </Card>
          <Card>
            <p className="text-xs text-text-muted">Pending AI Suggestions</p>
            <p className="mt-1 text-2xl font-semibold">{stats.totalRejected}</p>
          </Card>
          <Card>
            <p className="text-xs text-text-muted">Duplicate Groups</p>
            <p className="mt-1 text-2xl font-semibold">{stats.duplicateGroupCount}</p>
          </Card>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-semibold">Node Inspector</h2>
          <div className="flex flex-wrap items-end gap-2">
            <select value={inspectNodeType} onChange={(e) => setInspectNodeType(e.target.value as KnowledgeNodeType)} className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm">
              {KNOWLEDGE_NODE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input
              value={inspectNodeId}
              onChange={(e) => setInspectNodeId(e.target.value)}
              placeholder="Record id (e.g. asset_1)"
              className="min-w-[160px] flex-1 rounded-md border border-border bg-surface px-3 py-1.5 text-sm"
            />
            <Button variant="primary" onClick={handleInspect} disabled={inspecting}>
              Inspect
            </Button>
          </div>

          {inspection ? (
            <div className="mt-4 space-y-3 text-sm">
              <p className="text-text-muted">{inspection.relationshipSummary}</p>
              <p className="text-text-muted">{inspection.usageSummary}</p>
              <p className="text-text-muted">{inspection.dependencySummary}</p>

              {inspection.constraintViolations.length > 0 ? (
                <div>
                  <p className="mb-1 font-medium">Constraint Validation</p>
                  <ul className="space-y-1">
                    {inspection.constraintViolations.map((v, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <Badge tone={v.constraint.severity === "hard" ? "danger" : "warning"}>{v.constraint.severity}</Badge>
                        <span className="text-text-muted">{v.message}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-success">No constraint violations.</p>
              )}

              {inspection.oneHop.length > 0 ? (
                <div>
                  <p className="mb-1 font-medium">Direct Relationships ({inspection.oneHop.length})</p>
                  <ul className="space-y-1">
                    {inspection.oneHop.map((hop, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <Badge tone={hop.direction === "outbound" ? "accent" : "neutral"}>{hop.direction}</Badge>
                        <span>{RELATIONSHIP_TYPE_LABELS[hop.relationship.relationship_type]}</span>
                        <span className="text-text-muted">{nodeLabel(hop.node)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold">Path Explorer</h2>
          <div className="flex flex-wrap items-end gap-2">
            <select value={fromType} onChange={(e) => setFromType(e.target.value as KnowledgeNodeType)} className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm">
              {KNOWLEDGE_NODE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input value={fromId} onChange={(e) => setFromId(e.target.value)} placeholder="From id" className="w-28 rounded-md border border-border bg-surface px-3 py-1.5 text-sm" />
            <span className="text-text-muted">→</span>
            <select value={toType} onChange={(e) => setToType(e.target.value as KnowledgeNodeType)} className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm">
              {KNOWLEDGE_NODE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input value={toId} onChange={(e) => setToId(e.target.value)} placeholder="To id" className="w-28 rounded-md border border-border bg-surface px-3 py-1.5 text-sm" />
            <Button variant="primary" onClick={handleFindPath}>
              Find Path
            </Button>
          </div>

          {pathResult === "none" ? <p className="mt-4 text-sm text-text-muted">No path found within 5 hops.</p> : null}
          {pathResult && pathResult !== "none" ? (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
              {pathResult.map((node, i) => (
                <span key={i} className="flex items-center gap-2">
                  <span className="rounded-full bg-text/5 px-2 py-1">{nodeLabel(node)}</span>
                  {i < pathResult.length - 1 ? <span className="text-text-muted">→</span> : null}
                </span>
              ))}
            </div>
          ) : null}
        </Card>
      </div>

      {health &&
      (health.orphanedAssets.length > 0 || health.brokenRelationships.length > 0 || health.duplicateRelationshipGroups.length > 0 || health.circularReferenceGroups.length > 0) ? (
        <Card className="mt-6">
          <h2 className="mb-3 text-sm font-semibold">Knowledge Health</h2>
          <div className="space-y-4 text-sm">
            {health.orphanedAssets.length > 0 ? (
              <div>
                <p className="mb-1 font-medium">Orphaned Assets ({health.orphanedAssets.length})</p>
                <ul className="space-y-1">
                  {health.orphanedAssets.map((finding, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <Badge tone="warning">{finding.reason.replace(/_/g, " ")}</Badge>
                      <span className="text-text-muted">{finding.detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {health.brokenRelationships.length > 0 ? (
              <div>
                <p className="mb-1 font-medium">Broken Relationships ({health.brokenRelationships.length})</p>
                <ul className="space-y-1">
                  {health.brokenRelationships.map((r) => (
                    <li key={r.id} className="text-text-muted">
                      {nodeLabel({ nodeType: r.source_node_type, nodeId: r.source_node_id })} → {nodeLabel({ nodeType: r.target_node_type, nodeId: r.target_node_id })}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {health.duplicateRelationshipGroups.length > 0 ? <p>{health.duplicateRelationshipGroups.length} duplicate relationship group(s) found.</p> : null}
            {health.circularReferenceGroups.length > 0 ? <p className="text-danger">{health.circularReferenceGroups.length} circular reference group(s) found.</p> : null}
          </div>
        </Card>
      ) : null}

      <Card className="mt-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">All Relationships</h2>
          <div className="flex gap-2">
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm">
              <option value="all">All types</option>
              {Object.entries(RELATIONSHIP_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as RelationshipStatus | "all")} className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm">
              <option value="all">All statuses</option>
              {RELATIONSHIP_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filteredRelationships.length === 0 ? (
          <EmptyState title="No relationships match these filters" icon={AssetsIcon} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-text-muted">
                  <th className="py-2 pr-3">Source</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Target</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Role</th>
                </tr>
              </thead>
              <tbody>
                {filteredRelationships.slice(0, 100).map((r) => (
                  <tr key={r.id} className="border-b border-border/50">
                    <td className="py-2 pr-3">{nodeLabel({ nodeType: r.source_node_type, nodeId: r.source_node_id })}</td>
                    <td className="py-2 pr-3">{RELATIONSHIP_TYPE_LABELS[r.relationship_type]}</td>
                    <td className="py-2 pr-3">{nodeLabel({ nodeType: r.target_node_type, nodeId: r.target_node_id })}</td>
                    <td className="py-2 pr-3">
                      <Badge tone={r.status === "active" ? "success" : r.status === "archived" ? "neutral" : "warning"}>{r.status}</Badge>
                    </td>
                    <td className="py-2 pr-3 text-text-muted">{r.semantics?.role ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
