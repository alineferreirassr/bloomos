"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  evaluateProposalAction,
  listProposalTemplatesAction,
  listProposalPackagesAction,
  listProposalAddonsAction,
  createProposalVersionAction,
  publishProposalVersionAction,
  archiveProposalAction,
  restoreProposalVersionAction,
  compareProposalVersionsAction,
  sendProposalAction,
} from "@/modules/proposalPlatform/proposalPlatformActions";
import type { ProposalDetail, ProposalTemplate, ProposalPackage, ProposalAddon, ProposalComparisonResult, ProposalSection } from "@/types/proposalPlatform";
import { PROPOSAL_SECTION_LABELS, PROPOSAL_READINESS_LABELS } from "@/types/proposalPlatform";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { DocumentTemplatesIcon } from "@/components/ui/icons";
import { CommentsPanel } from "@/modules/communication/comments/components/CommentsPanel";

/**
 * v2.0 Checkpoint 33, Step 19 — Proposal Detail. Every figure comes
 * straight from `evaluateProposalAction` — nothing here recalculates
 * anything. "New Version" is a real, working builder over the Template/
 * Package/Add-on libraries and the Pricing Engine — a purposefully
 * compact form rather than a full drag-and-drop canvas, but every field
 * it submits flows through the same `CreateProposalVersionInput` the
 * engines were built and tested against.
 */

const READINESS_TONE: Record<string, BadgeTone> = { ready: "success", needs_review: "warning", missing_pricing: "danger", missing_client: "danger", missing_package: "warning", missing_sections: "warning", missing_terms: "warning", missing_approval: "warning" };

function formatMoney(minor: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(minor / 100);
}

export function ProposalDetailView({ proposalId }: { proposalId: string }) {
  const [detail, setDetail] = useState<ProposalDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<ProposalTemplate[]>([]);
  const [packages, setPackages] = useState<ProposalPackage[]>([]);
  const [addons, setAddons] = useState<ProposalAddon[]>([]);
  const [acting, setActing] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [selectedPackageIds, setSelectedPackageIds] = useState<string[]>([]);
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [depositPercent, setDepositPercent] = useState<number>(30);
  const [terms, setTerms] = useState("Standard terms apply.");
  const [policies, setPolicies] = useState("Standard cancellation policy applies.");
  const [compareA, setCompareA] = useState<number | null>(null);
  const [compareB, setCompareB] = useState<number | null>(null);
  const [comparison, setComparison] = useState<ProposalComparisonResult | null>(null);

  async function load() {
    const [detailResult, templatesResult, packagesResult, addonsResult] = await Promise.all([evaluateProposalAction(proposalId), listProposalTemplatesAction(), listProposalPackagesAction(), listProposalAddonsAction()]);
    if (detailResult.success) {
      setDetail(detailResult.data);
      setError(null);
    } else {
      setError(detailResult.error);
    }
    if (templatesResult.success) setTemplates(templatesResult.data);
    if (packagesResult.success) setPackages(packagesResult.data);
    if (addonsResult.success) setAddons(addonsResult.data);
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all([evaluateProposalAction(proposalId), listProposalTemplatesAction(), listProposalPackagesAction(), listProposalAddonsAction()]).then(([detailResult, templatesResult, packagesResult, addonsResult]) => {
      if (cancelled) return;
      if (detailResult.success) {
        setDetail(detailResult.data);
        setError(null);
      } else {
        setError(detailResult.error);
      }
      if (templatesResult.success) setTemplates(templatesResult.data);
      if (packagesResult.success) setPackages(packagesResult.data);
      if (addonsResult.success) setAddons(addonsResult.data);
    });
    return () => {
      cancelled = true;
    };
  }, [proposalId]);

  const selectedTemplate = useMemo(() => templates.find((t) => t.id === selectedTemplateId) ?? null, [templates, selectedTemplateId]);

  async function handleCreateVersion() {
    if (!selectedTemplate) return;
    setActing(true);

    const sections: ProposalSection[] = selectedTemplate.structure.sectionKeys.map((key, index) => ({
      id: `sec_${index}`,
      key,
      title: PROPOSAL_SECTION_LABELS[key],
      isCustom: false,
      blocks: [{ id: `blk_${index}`, type: "paragraph", order: 0, heading: null, text: "", mediaAssetIds: [], items: [], packageIds: key === "whats_included" ? selectedPackageIds : [], tone: null, placeholderLabel: null }],
    }));

    const selectedPackages = packages.filter((p) => selectedPackageIds.includes(p.id));
    const selectedAddons = addons.filter((a) => selectedAddonIds.includes(a.id));

    await createProposalVersionAction(proposalId, {
      templateId: selectedTemplate.id,
      templateKey: selectedTemplate.key,
      header: selectedTemplate.structure.header,
      hero: selectedTemplate.structure.hero,
      sections,
      packageIds: selectedPackageIds,
      addonIds: selectedAddonIds,
      variables: [],
      pricingInput: {
        currency: "USD",
        basePrice_minor: 0,
        lines: [
          ...selectedPackages.map((p) => ({ kind: "package" as const, refId: p.id, label: p.name, unitPrice_minor: p.basePrice_minor, quantity: 1, isOptional: false })),
          ...selectedAddons.map((a) => ({ kind: "addon" as const, refId: a.id, label: a.name, unitPrice_minor: a.price_minor, quantity: 1, isOptional: false })),
        ],
        discount: null,
        couponCode: null,
        taxRatePercent: null,
        depositPercent,
      },
      terms,
      policies,
      footer: selectedTemplate.structure.footer,
      notes: null,
      reason: null,
    });

    setBuilderOpen(false);
    await load();
    setActing(false);
  }

  async function handlePublish() {
    setActing(true);
    await publishProposalVersionAction(proposalId);
    await load();
    setActing(false);
  }

  async function handleArchive() {
    setActing(true);
    await archiveProposalAction(proposalId);
    await load();
    setActing(false);
  }

  async function handleRestore(versionId: string) {
    setActing(true);
    await restoreProposalVersionAction(proposalId, versionId);
    await load();
    setActing(false);
  }

  async function handleSend() {
    setActing(true);
    await sendProposalAction(proposalId);
    await load();
    setActing(false);
  }

  async function handleCompare() {
    if (compareA === null || compareB === null) return;
    const result = await compareProposalVersionsAction(proposalId, compareA, compareB);
    if (result.success) setComparison(result.data);
  }

  if (error) return <EmptyState title="This proposal isn't available" description={error} icon={DocumentTemplatesIcon} />;
  if (!detail) return <p className="text-sm text-text-muted">Loading proposal…</p>;

  const snapshot = detail.currentVersion?.snapshot ?? null;

  return (
    <div>
      <PageHeader
        title={snapshot?.header.title ?? "Untitled Proposal"}
        subtitle={`Proposal for Event ${detail.proposal.event_id} — currently ${detail.builderState?.status ?? "not yet built"}`}
        icon={DocumentTemplatesIcon}
        breadcrumb={[{ label: "Proposals", href: "/proposals" }, { label: snapshot?.header.title ?? "Proposal" }]}
        actions={
          <div className="flex items-center gap-3">
            <Badge tone={READINESS_TONE[detail.readiness.state] ?? "neutral"}>{PROPOSAL_READINESS_LABELS[detail.readiness.state]}</Badge>
            <Link href={`/clients/${detail.proposal.client_id}`} className="text-sm underline">
              View client
            </Link>
            <Button variant="secondary" onClick={() => setBuilderOpen((v) => !v)} disabled={acting}>
              New Version
            </Button>
            {detail.builderState && detail.builderState.status !== "published" && (
              <Button variant="secondary" onClick={handlePublish} disabled={acting}>
                Publish
              </Button>
            )}
            {detail.builderState && detail.builderState.status !== "archived" && (
              <Button variant="secondary" onClick={handleArchive} disabled={acting}>
                Archive
              </Button>
            )}
            <Button onClick={handleSend} disabled={acting || !detail.readiness.canSend}>
              Send to Client
            </Button>
          </div>
        }
      />

      {!detail.readiness.canSend && detail.readiness.reasons.length > 0 && (
        <Card className="mb-6 border-warning/40 bg-warning/5">
          <p className="text-sm text-warning">{detail.readiness.reasons[0]}</p>
        </Card>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <h2 className="mb-2 text-sm font-semibold">Overall Health</h2>
          <p className="text-2xl font-semibold">{detail.health.overallScore}</p>
        </Card>
        <Card>
          <h2 className="mb-2 text-sm font-semibold">Current Version</h2>
          <p className="text-2xl font-semibold">{detail.currentVersion?.version_number ?? "—"}</p>
        </Card>
        <Card>
          <h2 className="mb-2 text-sm font-semibold">Grand Total</h2>
          <p className="text-2xl font-semibold">{snapshot ? formatMoney(snapshot.pricing.grandTotal_minor, snapshot.pricing.currency) : "—"}</p>
        </Card>
        <Card>
          <h2 className="mb-2 text-sm font-semibold">Deposit Due</h2>
          <p className="text-2xl font-semibold">{snapshot ? formatMoney(snapshot.pricing.depositDue_minor, snapshot.pricing.currency) : "—"}</p>
        </Card>
      </div>

      {builderOpen && (
        <Card className="mb-6">
          <h2 className="mb-3 text-sm font-semibold">Build a New Version</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="text-sm">
              Template
              <select className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1 text-sm" value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(e.target.value)}>
                <option value="">Select a template…</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Deposit %
              <input type="number" min={0} max={100} className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1 text-sm" value={depositPercent} onChange={(e) => setDepositPercent(Number(e.target.value))} />
            </label>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-medium">Packages</p>
              <ul role="list" className="space-y-1">
                {packages.map((p) => (
                  <li key={p.id} role="listitem">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedPackageIds.includes(p.id)}
                        onChange={(e) => setSelectedPackageIds((prev) => (e.target.checked ? [...prev, p.id] : prev.filter((id) => id !== p.id)))}
                      />
                      {p.name} — {formatMoney(p.basePrice_minor, p.currency)}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Add-ons</p>
              <ul role="list" className="space-y-1">
                {addons.map((a) => (
                  <li key={a.id} role="listitem">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedAddonIds.includes(a.id)}
                        onChange={(e) => setSelectedAddonIds((prev) => (e.target.checked ? [...prev, a.id] : prev.filter((id) => id !== a.id)))}
                      />
                      {a.name} — {formatMoney(a.price_minor, a.currency)}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="text-sm">
              Terms
              <textarea className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1 text-sm" rows={3} value={terms} onChange={(e) => setTerms(e.target.value)} />
            </label>
            <label className="text-sm">
              Policies
              <textarea className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1 text-sm" rows={3} value={policies} onChange={(e) => setPolicies(e.target.value)} />
            </label>
          </div>

          <Button className="mt-4" onClick={handleCreateVersion} disabled={acting || !selectedTemplate}>
            Create Version
          </Button>
        </Card>
      )}

      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-semibold">Sections</h2>
        {!snapshot || snapshot.sections.length === 0 ? (
          <p className="text-sm text-text-muted">No sections yet — build a version to add content.</p>
        ) : (
          <ul role="list" className="grid grid-cols-1 gap-2 md:grid-cols-3">
            {snapshot.sections.map((s) => (
              <li key={s.id} role="listitem" className="rounded-md border border-border/50 px-3 py-2 text-sm">
                {s.title} <span className="text-text-muted">({s.blocks.length} block{s.blocks.length === 1 ? "" : "s"})</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-semibold">Version History</h2>
        {!detail.builderState || detail.builderState.versions.length === 0 ? (
          <p className="text-sm text-text-muted">No versions yet.</p>
        ) : (
          <ul role="list">
            {detail.builderState.versions.map((v) => (
              <li key={v.id} role="listitem" className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-b-0">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    Version {v.version_number} {v.id === detail.builderState?.current_version_id && <Badge tone="accent">current</Badge>}
                  </p>
                  <p className="text-xs text-text-muted">{new Date(v.created_at).toLocaleString()}</p>
                </div>
                {v.id !== detail.builderState?.current_version_id && (
                  <Button variant="secondary" onClick={() => handleRestore(v.id)} disabled={acting}>
                    Restore
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}

        {detail.builderState && detail.builderState.versions.length > 1 && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <select className="rounded-md border border-border bg-surface px-2 py-1 text-sm" value={compareA ?? ""} onChange={(e) => setCompareA(Number(e.target.value))}>
              <option value="">Version A</option>
              {detail.builderState.versions.map((v) => (
                <option key={v.id} value={v.version_number}>
                  Version {v.version_number}
                </option>
              ))}
            </select>
            <select className="rounded-md border border-border bg-surface px-2 py-1 text-sm" value={compareB ?? ""} onChange={(e) => setCompareB(Number(e.target.value))}>
              <option value="">Version B</option>
              {detail.builderState.versions.map((v) => (
                <option key={v.id} value={v.version_number}>
                  Version {v.version_number}
                </option>
              ))}
            </select>
            <Button variant="secondary" onClick={handleCompare} disabled={compareA === null || compareB === null}>
              Compare
            </Button>
          </div>
        )}

        {comparison && (
          <div className="mt-4">
            <p className="mb-2 text-sm font-medium">
              {comparison.hasChanges ? `${comparison.diffs.length} difference(s) found` : "No differences found"}
            </p>
            {comparison.diffs.length > 0 && (
              <ul role="list" className="space-y-1">
                {comparison.diffs.map((d, i) => (
                  <li key={i} role="listitem" className="text-xs text-text-muted">
                    <span className="font-medium capitalize">{d.category}</span> · {d.field}: {d.before ?? "—"} → {d.after ?? "—"}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Card>

      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-semibold">Health Breakdown</h2>
        <ul role="list" className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {detail.health.categories.map((c) => (
            <li key={c.category} role="listitem" className="flex items-center justify-between rounded-md border border-border/50 px-3 py-2 text-sm">
              <span className="capitalize">{c.category.replace("_", " ")}</span>
              <span>{c.score === null ? "N/A" : c.score}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold">Internal Notes &amp; Comments</h2>
        <CommentsPanel ownerType="proposal" ownerId={proposalId} />
      </Card>
    </div>
  );
}
