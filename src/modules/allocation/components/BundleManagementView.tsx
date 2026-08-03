"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listResourceBundlesAction } from "@/modules/allocation/allocationActions";
import type { ResourceBundle } from "@/types/allocation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { AssetsIcon } from "@/components/ui/icons";

/**
 * v2.0 Checkpoint 27.1, Step 21 — Bundle Management. Read-only listing of
 * every `ResourceBundle` template — the reusable "Photography Crew"-style
 * groupings `BundleEngine` translates into requirement lines. Same
 * disclosed "no create control wired yet" scope as the rest of this
 * checkpoint's UI: `createResourceBundleAction`/`updateResourceBundleAction`/
 * `duplicateResourceBundleAction` exist and are fully tested in
 * `allocationActions.ts`, ready for a future form.
 */
const STATUS_TONE: Record<ResourceBundle["status"], BadgeTone> = { active: "success", archived: "outline" };

function BundleCard({ bundle }: { bundle: ResourceBundle }) {
  return (
    <Card className="mb-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">{bundle.name}</h2>
        <Badge tone={STATUS_TONE[bundle.status]}>{bundle.status}</Badge>
      </div>
      {bundle.description ? <p className="mb-3 text-sm text-text-muted">{bundle.description}</p> : null}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="mb-1 text-xs font-medium text-text-muted">Required ({bundle.required_resources.length})</p>
          {bundle.required_resources.length === 0 ? (
            <p className="text-xs text-text-muted">None</p>
          ) : (
            <ul role="list">
              {bundle.required_resources.map((line, i) => (
                <li key={i} role="listitem" className="text-sm">
                  {line.quantity}× {line.resource_type}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-text-muted">Optional ({bundle.optional_resources.length})</p>
          {bundle.optional_resources.length === 0 ? (
            <p className="text-xs text-text-muted">None</p>
          ) : (
            <ul role="list">
              {bundle.optional_resources.map((line, i) => (
                <li key={i} role="listitem" className="text-sm">
                  {line.quantity}× {line.resource_type}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}

export function BundleManagementView() {
  const [bundles, setBundles] = useState<ResourceBundle[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [includeArchived, setIncludeArchived] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listResourceBundlesAction(includeArchived).then((result) => {
      if (cancelled) return;
      if (result.success) setBundles(result.data);
      else setError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, [includeArchived]);

  const activeCount = (bundles ?? []).filter((b) => b.status === "active").length;

  return (
    <div>
      <PageHeader
        title="Resource Bundles"
        subtitle="Reusable resource-group templates — e.g. a Photography Crew — that translate into requirement lines for an Allocation Request."
        icon={AssetsIcon}
        breadcrumb={[{ label: "Resource Allocation", href: "/allocations" }, { label: "Bundles" }]}
      />

      {error ? <EmptyState title="Resource Bundles aren't available" description={error} icon={AssetsIcon} /> : null}

      {bundles ? (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
            <KpiCard label="Total Bundles" value={String(bundles.length)} icon={AssetsIcon} />
            <KpiCard label="Active" value={String(activeCount)} icon={AssetsIcon} />
            <KpiCard label="Archived" value={String(bundles.length - activeCount)} icon={AssetsIcon} />
          </div>

          <button type="button" onClick={() => setIncludeArchived((v) => !v)} className="mb-4 text-sm text-accent hover:underline">
            {includeArchived ? "Hide archived bundles" : "Show archived bundles"}
          </button>

          {bundles.length === 0 ? (
            <EmptyState title="No resource bundles yet" description="Resource bundles are created through the Resource Bundle registry." icon={AssetsIcon} />
          ) : (
            bundles.map((b) => <BundleCard key={b.id} bundle={b} />)
          )}
        </>
      ) : !error ? (
        <p className="text-sm text-text-muted">Loading resource bundles…</p>
      ) : null}

      <Link href="/allocations" className="mt-2 inline-block text-sm text-accent hover:underline">
        ← Back to Resource Allocation
      </Link>
    </div>
  );
}
