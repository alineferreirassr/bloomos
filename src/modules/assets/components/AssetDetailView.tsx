"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { setMediaAssetStatus, getMediaAssetDownloadUrl, setMediaAssetTags, updateMediaAssetMetadata } from "@/lib/data";
import { getNodeRelationshipsAction, type NodeKnowledgeData } from "@/modules/knowledgeGraph/knowledgeGraphActions";
import { AssetIntelligencePanel } from "@/modules/assets/components/AssetIntelligencePanel";
import { RELATIONSHIP_TYPE_LABELS, RELATIONSHIP_ROLE_LABELS } from "@/types/knowledgeGraph";
import type { MediaAsset } from "@/types/mediaAsset";
import { categorizeAsset, ASSET_CATEGORY_LABELS } from "@/modules/assets/assetCategory";
import { computeAspectRatio, computeOrientation } from "@/core/media/metadataEngine";
import { MEDIA_ASSET_STATUS_LABELS } from "@/core/enums/mediaAssetStatus";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { AssetsIcon } from "@/components/ui/icons";
import { useMemberSession } from "@/components/providers/MemberSessionProvider";

const STATUS_TONE: Record<MediaAsset["status"], BadgeTone> = {
  approved: "success",
  pending: "neutral",
  needs_revision: "warning",
  rejected: "danger",
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * v2.0 Checkpoint 25, Steps 1-2/9 — a working Asset detail page covering
 * Overview + Approval Workflow actions. Step 11 (Asset Intelligence 360°)
 * expands this same route with Metadata/Timeline/Versions/Relationships/
 * Usage tabs — this is the real foundation those tabs attach to, not a
 * throwaway placeholder.
 */
export function AssetDetailView({ asset: initialAsset }: { asset: MediaAsset }) {
  const router = useRouter();
  const { profile, user, can } = useMemberSession();
  const [asset, setAsset] = useState(initialAsset);
  const [busy, setBusy] = useState(false);
  const [knowledge, setKnowledge] = useState<NodeKnowledgeData | null>(null);
  const canManage = can("assets.manage");
  const category = categorizeAsset(asset);

  useEffect(() => {
    let cancelled = false;
    getNodeRelationshipsAction({ nodeType: "media_asset", nodeId: asset.id }).then((result) => {
      if (!cancelled && result.success) setKnowledge(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [asset.id]);

  async function handleStatusChange(next: "approved" | "rejected" | "needs_revision") {
    if (!user) return;
    setBusy(true);
    const actor = profile?.full_name ?? user.email;
    const reason = next !== "approved" ? window.prompt("Reason (optional)") : null;
    const result = await setMediaAssetStatus(asset.id, next, actor, reason, user.id);
    if (result.success) setAsset(result.data);
    setBusy(false);
  }

  async function handleDownload() {
    const result = await getMediaAssetDownloadUrl(asset.id);
    if (result.success) window.open(result.data.url, "_blank");
  }

  async function handleAddTag() {
    const tag = window.prompt("Add tag");
    if (!tag || !tag.trim()) return;
    const result = await setMediaAssetTags(asset.id, [...asset.tags, tag.trim()]);
    if (result.success) setAsset(result.data);
  }

  async function handleRemoveTag(tag: string) {
    const result = await setMediaAssetTags(asset.id, asset.tags.filter((t) => t !== tag));
    if (result.success) setAsset(result.data);
  }

  async function handleEditMetadataField(field: "author" | "license" | "brand") {
    const current = asset.metadata[field] ?? "";
    const next = window.prompt(`Edit ${field}`, current ?? "");
    if (next === null) return;
    const result = await updateMediaAssetMetadata(asset.id, { [field]: next.trim() || null });
    if (result.success) setAsset(result.data);
  }

  return (
    <div>
      <PageHeader
        title={asset.original_filename}
        subtitle={`${ASSET_CATEGORY_LABELS[category]} · v${asset.version} · ${formatFileSize(asset.file_size)}`}
        icon={AssetsIcon}
        breadcrumb={[{ label: "Asset Library", href: "/assets" }, { label: asset.original_filename }]}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => router.push("/assets")}>
              Back to Library
            </Button>
            <Button variant="primary" onClick={handleDownload}>
              Download
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold">Overview</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-text-muted">Status</dt>
              <dd className="mt-1">
                <Badge tone={STATUS_TONE[asset.status]}>{MEDIA_ASSET_STATUS_LABELS[asset.status]}</Badge>
              </dd>
            </div>
            <div>
              <dt className="text-text-muted">File Type</dt>
              <dd className="mt-1">{asset.mime_type}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Uploaded</dt>
              <dd className="mt-1">{new Date(asset.created_at).toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Last Updated</dt>
              <dd className="mt-1">{new Date(asset.updated_at).toLocaleString()}</dd>
            </div>
            {asset.width && asset.height ? (
              <>
                <div>
                  <dt className="text-text-muted">Dimensions</dt>
                  <dd className="mt-1">
                    {asset.width} × {asset.height} ({computeAspectRatio(asset)}, {computeOrientation(asset)})
                  </dd>
                </div>
              </>
            ) : null}
            {asset.rejection_reason ? (
              <div className="col-span-2">
                <dt className="text-text-muted">Reviewer Note</dt>
                <dd className="mt-1">{asset.rejection_reason}</dd>
              </div>
            ) : null}
          </dl>

          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between">
              <h3 className="text-xs font-medium text-text-muted">Tags</h3>
              {canManage ? (
                <button type="button" onClick={handleAddTag} className="text-xs text-accent hover:underline">
                  + Add tag
                </button>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {asset.tags.length === 0 ? <span className="text-xs text-text-muted">No tags yet.</span> : null}
              {asset.tags.map((tag) => (
                <span key={tag} className="flex items-center gap-1 rounded-full bg-text/5 px-2 py-0.5 text-xs text-text-muted">
                  {tag}
                  {canManage ? (
                    <button type="button" onClick={() => handleRemoveTag(tag)} aria-label={`Remove tag ${tag}`} className="text-text-muted hover:text-danger">
                      ×
                    </button>
                  ) : null}
                </span>
              ))}
            </div>
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          {canManage ? (
            <Card>
              <h2 className="mb-3 text-sm font-semibold">Approval Workflow</h2>
              <div className="flex flex-col gap-2">
                <Button variant="primary" disabled={busy || asset.status === "approved"} onClick={() => handleStatusChange("approved")}>
                  Approve
                </Button>
                <Button variant="secondary" disabled={busy} onClick={() => handleStatusChange("needs_revision")}>
                  Request Revision
                </Button>
                <Button variant="secondary" disabled={busy || asset.status === "rejected"} onClick={() => handleStatusChange("rejected")}>
                  Reject
                </Button>
              </div>
            </Card>
          ) : null}

          <Card>
            <h2 className="mb-3 text-sm font-semibold">Metadata</h2>
            <dl className="space-y-2 text-sm">
              {(["author", "license", "brand"] as const).map((field) => (
                <div key={field} className="flex items-center justify-between gap-2">
                  <div>
                    <dt className="text-text-muted capitalize">{field}</dt>
                    <dd className="mt-0.5">{asset.metadata[field] ?? "—"}</dd>
                  </div>
                  {canManage ? (
                    <button type="button" onClick={() => handleEditMetadataField(field)} className="shrink-0 text-xs text-accent hover:underline">
                      Edit
                    </button>
                  ) : null}
                </div>
              ))}
            </dl>
          </Card>
        </div>
      </div>

      {knowledge ? (
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="mb-3 text-sm font-semibold">Knowledge</h2>
            <p className="text-sm text-text-muted">{knowledge.relationshipSummary}</p>
            <p className="mt-2 text-sm text-text-muted">{knowledge.connectionSummary}</p>
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-semibold">Dependencies &amp; Impact Analysis</h2>
            <p className="text-sm text-text-muted">{knowledge.dependencySummary}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              {(
                [
                  ["Events", knowledge.impact.affectedEvents.length],
                  ["Clients", knowledge.impact.affectedClients.length],
                  ["Documents", knowledge.impact.affectedDocuments.length],
                  ["Workflows", knowledge.impact.affectedWorkflows.length],
                  ["Automations", knowledge.impact.affectedAutomations.length],
                  ["Collections", knowledge.impact.affectedCollections.length],
                  ["Timeline Entries", knowledge.impact.affectedTimelineEntries.length],
                  ["AI Context", knowledge.impact.affectedAiContext.length],
                ] as const
              )
                .filter(([, count]) => count > 0)
                .map(([label, count]) => (
                  <div key={label} className="rounded-md bg-surface-tint px-2 py-1.5">
                    <span className="font-medium">{count}</span> <span className="text-text-muted">{label}</span>
                  </div>
                ))}
              {knowledge.impact.base.isSafeToDelete ? <p className="col-span-2 text-success">Safe to delete — nothing depends on this asset.</p> : null}
            </div>
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-semibold">Constraint Validation</h2>
            {knowledge.constraintViolations.length === 0 ? (
              <p className="text-sm text-success">No constraint violations.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {knowledge.constraintViolations.map((v, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Badge tone={v.constraint.severity === "hard" ? "danger" : "warning"}>{v.constraint.severity}</Badge>
                    <span className="text-text-muted">{v.message}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-semibold">Semantic Relationships &amp; Usage Graph</h2>
            {knowledge.oneHop.length === 0 ? (
              <p className="text-sm text-text-muted">No relationships recorded yet.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {knowledge.oneHop.map((hop, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-2">
                    <Badge tone={hop.direction === "outbound" ? "accent" : "neutral"}>{hop.direction}</Badge>
                    <span>{RELATIONSHIP_TYPE_LABELS[hop.relationship.relationship_type]}</span>
                    <span className="text-text-muted">
                      {hop.node.nodeType}:{hop.node.nodeId}
                    </span>
                    {hop.relationship.semantics?.role ? <Badge tone="accent">{RELATIONSHIP_ROLE_LABELS[hop.relationship.semantics.role]}</Badge> : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      ) : null}

      <AssetIntelligencePanel assetId={asset.id} />
    </div>
  );
}
