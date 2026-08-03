"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { evaluateWorkerCapabilityAction, type WorkerCapabilitySummary } from "@/modules/capability/capabilityActions";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { TeamIcon } from "@/components/ui/icons";

/**
 * v2.0 Checkpoint 26.1, Step 23 — Worker Capability View. There was no
 * standalone Worker detail page before this checkpoint (Checkpoint 26's
 * Workforce Dashboard only ever listed workers inline); this route is a
 * new, minimal Worker detail surface built specifically to host this
 * capability summary, not a retrofit of an existing page.
 */
const SEVERITY_TONE: Record<string, BadgeTone> = { high: "danger", medium: "warning", low: "neutral" };

export function WorkerCapabilityView({ workerId }: { workerId: string }) {
  const [summary, setSummary] = useState<WorkerCapabilitySummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    evaluateWorkerCapabilityAction(workerId).then((result) => {
      if (cancelled) return;
      if (result.success) setSummary(result.data);
      else setError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, [workerId]);

  if (error) return <EmptyState title="This worker's capability summary isn't available" description={error} icon={TeamIcon} />;
  if (!summary) return <p className="text-sm text-text-muted">Loading…</p>;

  const { worker } = summary;
  const expiringCertifications = worker.certifications.filter((c) => c.expiration_date !== null);
  const primarySkills = worker.skills.filter((s) => s.level === "primary");

  return (
    <div>
      <PageHeader
        title={`${worker.first_name} ${worker.last_name}`}
        subtitle={`${worker.role.replace(/_/g, " ")} — capability summary`}
        icon={TeamIcon}
        breadcrumb={[{ label: "Asset Library", href: "/assets" }, { label: "Workforce", href: "/assets/workforce" }, { label: `${worker.first_name} ${worker.last_name}` }]}
      />

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <h2 className="mb-3 text-sm font-semibold">
            Eligible For <span className="font-normal text-text-muted">({summary.eligibleRequirements.length})</span>
          </h2>
          {summary.eligibleRequirements.length === 0 ? (
            <p className="text-sm text-text-muted">No requirements yet.</p>
          ) : (
            <ul role="list" className="space-y-1.5 text-sm">
              {summary.eligibleRequirements.map(({ requirement, entry }) => (
                <li key={requirement.id} role="listitem" className="flex items-center justify-between">
                  <Link href={`/assets/workforce/capabilities/${requirement.id}`} className="truncate text-accent hover:underline">
                    {requirement.title}
                  </Link>
                  <span className="text-xs text-text-muted">{entry.scores.overallCapabilityScore}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold">
            Conditionally Eligible <span className="font-normal text-text-muted">({summary.conditionallyEligibleRequirements.length})</span>
          </h2>
          {summary.conditionallyEligibleRequirements.length === 0 ? (
            <p className="text-sm text-text-muted">None.</p>
          ) : (
            <ul role="list" className="space-y-1.5 text-sm">
              {summary.conditionallyEligibleRequirements.map(({ requirement }) => (
                <li key={requirement.id} role="listitem">
                  <Link href={`/assets/workforce/capabilities/${requirement.id}`} className="truncate text-accent hover:underline">
                    {requirement.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold">
            Ineligible <span className="font-normal text-text-muted">({summary.ineligibleRequirements.length})</span>
          </h2>
          {summary.ineligibleRequirements.length === 0 ? (
            <p className="text-sm text-success">None.</p>
          ) : (
            <ul role="list" className="space-y-1.5 text-sm">
              {summary.ineligibleRequirements.map(({ requirement }) => (
                <li key={requirement.id} role="listitem">
                  <Link href={`/assets/workforce/capabilities/${requirement.id}`} className="truncate text-accent hover:underline">
                    {requirement.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-semibold">Strongest Skills</h2>
          {primarySkills.length === 0 ? <p className="text-sm text-text-muted">No primary skills recorded.</p> : <p className="text-sm">{primarySkills.map((s) => s.name).join(", ")}</p>}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold">Certifications</h2>
          {expiringCertifications.length === 0 ? (
            <p className="text-sm text-text-muted">No certifications with an expiration date.</p>
          ) : (
            <ul role="list" className="space-y-1.5 text-sm">
              {expiringCertifications.map((c) => (
                <li key={c.id} role="listitem" className="flex items-center justify-between">
                  <span>{c.name}</span>
                  <span className="text-xs text-text-muted">{c.expiration_date?.slice(0, 10)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <h2 className="mb-3 text-sm font-semibold">
          Capability Risks <span className="font-normal text-text-muted">({summary.relatedRisks.length})</span>
        </h2>
        {summary.relatedRisks.length === 0 ? (
          <p className="text-sm text-success">No capability risks are tied to this worker.</p>
        ) : (
          <ul role="list" className="space-y-1.5 text-sm">
            {summary.relatedRisks.map((r) => (
              <li key={r.id} role="listitem" className="flex items-center justify-between">
                <span>{r.description}</span>
                <Badge tone={SEVERITY_TONE[r.severity] ?? "neutral"}>{r.severity}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
