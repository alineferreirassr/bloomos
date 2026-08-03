"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listPlanTemplatesAction } from "@/modules/operationalPlanning/operationalPlanningActions";
import type { PlanTemplate } from "@/types/operationalPlanning";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { DocumentTemplatesIcon } from "@/components/ui/icons";

/**
 * v2.0 Checkpoint 27.2, Step 21 — Plan Template Library. Read-only
 * listing of every `PlanTemplate` — the reusable Wedding Proposal /
 * Luxury Picnic / Hotel Decoration-style structures `OperationalPlan`s
 * are instantiated from. Same disclosed "no create control wired yet"
 * scope as `BundleManagementView.tsx`: `createPlanTemplateAction`/
 * `updatePlanTemplateAction`/`duplicatePlanTemplateAction` exist and are
 * fully tested in `operationalPlanningActions.ts`, ready for a future form.
 */
const STATUS_TONE: Record<PlanTemplate["status"], BadgeTone> = { active: "success", archived: "outline" };

function TemplateCard({ template }: { template: PlanTemplate }) {
  const stepCount = template.phases.reduce((sum, p) => sum + p.steps.length, 0);
  return (
    <Card className="mb-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{template.name}</h2>
          <p className="text-xs text-text-muted">{template.category.replace(/_/g, " ")} · version {template.version}</p>
        </div>
        <Badge tone={STATUS_TONE[template.status]}>{template.status}</Badge>
      </div>
      {template.description ? <p className="mb-3 text-sm text-text-muted">{template.description}</p> : null}
      <div className="grid grid-cols-3 gap-4 md:grid-cols-6">
        <div>
          <p className="text-xs text-text-muted">Phases</p>
          <p className="text-sm font-medium">{template.phases.length}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Steps</p>
          <p className="text-sm font-medium">{stepCount}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Milestones</p>
          <p className="text-sm font-medium">{template.milestones.length}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Deliverables</p>
          <p className="text-sm font-medium">{template.deliverables.length}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Evidence</p>
          <p className="text-sm font-medium">{template.evidence_requirements.length}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Approvals</p>
          <p className="text-sm font-medium">{template.approvals.length}</p>
        </div>
      </div>
    </Card>
  );
}

export function PlanTemplateLibraryView() {
  const [templates, setTemplates] = useState<PlanTemplate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [includeArchived, setIncludeArchived] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listPlanTemplatesAction(includeArchived).then((result) => {
      if (cancelled) return;
      if (result.success) setTemplates(result.data);
      else setError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, [includeArchived]);

  const activeCount = (templates ?? []).filter((t) => t.status === "active").length;
  const categoryCount = new Set((templates ?? []).map((t) => t.category)).size;

  return (
    <div>
      <PageHeader
        title="Plan Templates"
        subtitle="Reusable execution-plan structures — e.g. a Wedding Proposal or Luxury Picnic — that Operational Plans are instantiated from."
        icon={DocumentTemplatesIcon}
        breadcrumb={[{ label: "Operational Planning", href: "/operational-planning" }, { label: "Templates" }]}
      />

      {error ? <EmptyState title="Plan Templates aren't available" description={error} icon={DocumentTemplatesIcon} /> : null}

      {templates ? (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard label="Total Templates" value={String(templates.length)} icon={DocumentTemplatesIcon} />
            <KpiCard label="Active" value={String(activeCount)} icon={DocumentTemplatesIcon} />
            <KpiCard label="Archived" value={String(templates.length - activeCount)} icon={DocumentTemplatesIcon} />
            <KpiCard label="Categories" value={String(categoryCount)} icon={DocumentTemplatesIcon} />
          </div>

          <button type="button" onClick={() => setIncludeArchived((v) => !v)} className="mb-4 text-sm text-accent hover:underline">
            {includeArchived ? "Hide archived templates" : "Show archived templates"}
          </button>

          {templates.length === 0 ? (
            <EmptyState title="No plan templates yet" description="Plan templates are created through the Plan Template registry." icon={DocumentTemplatesIcon} />
          ) : (
            templates.map((t) => <TemplateCard key={t.id} template={t} />)
          )}
        </>
      ) : !error ? (
        <p className="text-sm text-text-muted">Loading plan templates…</p>
      ) : null}

      <Link href="/operational-planning" className="mt-2 inline-block text-sm text-accent hover:underline">
        ← Back to Operational Planning
      </Link>
    </div>
  );
}
