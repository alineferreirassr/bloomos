"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Skeleton } from "@/components/ui/Skeleton";
import { ProgressBar } from "@/components/ui/ProgressBar";
import {
  evaluateContractAction,
  listContractBuilderTemplatesAction,
  createContractVersionAction,
  publishContractVersionAction,
  archiveContractDocumentAction,
  restoreContractVersionAction,
  compareContractVersionsAction,
  markContractReadyAction,
} from "@/modules/contractPlatform/contractPlatformActions";
import { CONTRACT_BUILDER_TEMPLATE_LABELS, CONTRACT_SECTION_LABELS, CONTRACT_READINESS_LABELS, CONTRACT_HEALTH_CATEGORY_LABELS } from "@/types/contractPlatform";
import type { ContractBuilderTemplate, ContractDetail, ContractComparisonResult, CreateContractVersionInput, ContractSection } from "@/types/contractPlatform";
import { useMemberSession } from "@/components/providers/MemberSessionProvider";

/**
 * v2.0 Checkpoint 34 — Contract Detail's own new "Document" section (Step 18).
 * Additive alongside the real Contract's own commercial fields/actions above
 * it — never a replacement. No electronic signing, no PDF export, no email
 * sending: this section only prepares and versions the human-curated
 * document (template, sections, clauses, terms, policies), matching the
 * checkpoint's own explicit scope.
 */

const READINESS_TONE: Record<string, BadgeTone> = {
  ready: "success",
  needs_review: "warning",
  needs_approval: "warning",
  missing_variables: "warning",
  missing_client: "danger",
  missing_proposal: "danger",
  missing_sections: "danger",
  missing_clauses: "danger",
};

function sectionsFromTemplate(template: ContractBuilderTemplate): ContractSection[] {
  return template.structure.sectionKeys.map((key, i) => ({
    id: `section_${i}_${key}`,
    key,
    title: CONTRACT_SECTION_LABELS[key],
    isCustom: false,
    blocks: [],
  }));
}

export function ContractDocumentSection({ contractId }: { contractId: string }) {
  const { can } = useMemberSession();
  const canManage = can("contract_builder.manage");

  const [detail, setDetail] = useState<ContractDetail | null | "loading" | "error">("loading");
  const [templates, setTemplates] = useState<ContractBuilderTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [terms, setTerms] = useState("");
  const [policies, setPolicies] = useState("");
  const [notes, setNotes] = useState("");
  const [compareA, setCompareA] = useState<number | null>(null);
  const [compareB, setCompareB] = useState<number | null>(null);
  const [comparison, setComparison] = useState<ContractComparisonResult | null>(null);

  const refetch = () => {
    evaluateContractAction(contractId).then((result) => {
      setDetail(result.success ? result.data : "error");
      if (result.success) {
        setTerms(result.data.currentVersion?.snapshot.terms ?? "");
        setPolicies(result.data.currentVersion?.snapshot.policies ?? "");
      }
    });
  };

  useEffect(() => {
    refetch();
    listContractBuilderTemplatesAction().then((result) => {
      if (result.success) setTemplates(result.data);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractId]);

  if (detail === "loading") {
    return (
      <Card>
        <h3 className="font-serif text-[17px] font-semibold text-text">Contract Document</h3>
        <div className="mt-3 space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </Card>
    );
  }

  if (detail === "error" || detail === null) {
    return (
      <Card>
        <h3 className="font-serif text-[17px] font-semibold text-text">Contract Document</h3>
        <p className="mt-2 text-sm text-text-muted">Not available.</p>
      </Card>
    );
  }

  const { builderState, currentVersion, health, readiness } = detail;

  const runAction = async (key: string, fn: () => Promise<{ success: boolean; error?: string }>) => {
    setBusy(key);
    setActionError(null);
    const result = await fn();
    setBusy(null);
    if (!result.success) {
      setActionError(result.error ?? "Something went wrong.");
      return;
    }
    refetch();
  };

  const handleStartDocument = async () => {
    const template = templates.find((t) => t.id === selectedTemplateId);
    if (!template) return;
    const input: CreateContractVersionInput = {
      builderTemplateId: template.id,
      builderTemplateKey: template.key,
      header: template.structure.header,
      sections: sectionsFromTemplate(template),
      clauseIds: [],
      terms: "",
      policies: "",
      footer: template.structure.footer,
      notes: null,
      reason: "Initial document generated from template.",
    };
    await runAction("start", () => createContractVersionAction(contractId, input));
  };

  const handleNewVersion = async () => {
    if (!currentVersion) return;
    const input: CreateContractVersionInput = {
      builderTemplateId: currentVersion.snapshot.builderTemplateId,
      builderTemplateKey: currentVersion.snapshot.builderTemplateKey,
      header: currentVersion.snapshot.header,
      sections: currentVersion.snapshot.sections,
      clauseIds: currentVersion.snapshot.clauseIds,
      terms,
      policies,
      footer: currentVersion.snapshot.footer,
      notes: notes.trim() || null,
      reason: "Document updated.",
    };
    await runAction("version", () => createContractVersionAction(contractId, input));
  };

  const handleCompare = async () => {
    if (compareA === null || compareB === null) return;
    setBusy("compare");
    setActionError(null);
    const result = await compareContractVersionsAction(contractId, compareA, compareB);
    setBusy(null);
    if (!result.success) {
      setActionError(result.error);
      return;
    }
    setComparison(result.data);
  };

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-serif text-[17px] font-semibold text-text">Contract Document</h3>
        {builderState ? <Badge tone="neutral">{builderState.status}</Badge> : null}
      </div>

      {actionError ? (
        <p role="alert" className="mt-2 text-xs text-danger">
          {actionError}
        </p>
      ) : null}

      {!builderState || !currentVersion ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-text-muted">No document has been started for this contract yet.</p>
          {canManage ? (
            <div className="flex flex-wrap items-center gap-2">
              <Select value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(e.target.value)} className="max-w-xs">
                <option value="">Select a template…</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {CONTRACT_BUILDER_TEMPLATE_LABELS[t.key]}
                  </option>
                ))}
              </Select>
              <Button onClick={handleStartDocument} disabled={!selectedTemplateId || busy === "start"}>
                {busy === "start" ? "Generating…" : "Generate First Draft"}
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 space-y-5">
          <div>
            <div className="flex items-center justify-between text-xs text-text-muted">
              <span>Document health</span>
              <span>{health.overallScore}/100</span>
            </div>
            <ProgressBar value={health.overallScore} label="Contract document health" className="mt-1" />
            <ul className="mt-2 space-y-1 text-xs text-text-muted">
              {health.categories.map((c) => (
                <li key={c.category} className="flex items-center justify-between">
                  <span>{CONTRACT_HEALTH_CATEGORY_LABELS[c.category]}</span>
                  <span>{c.score === null ? "N/A" : `${c.score}/100`}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={READINESS_TONE[readiness.state] ?? "neutral"}>{CONTRACT_READINESS_LABELS[readiness.state]}</Badge>
              {readiness.reasons.map((r, i) => (
                <span key={i} className="text-xs text-text-muted">
                  {r}
                </span>
              ))}
            </div>
            {canManage ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {readiness.canPublish && builderState.status !== "published" ? (
                  <Button onClick={() => runAction("publish", () => publishContractVersionAction(contractId))} disabled={busy === "publish"}>
                    {busy === "publish" ? "Publishing…" : "Publish Document"}
                  </Button>
                ) : null}
                {readiness.state === "ready" && !builderState.ready_at ? (
                  <Button variant="secondary" onClick={() => runAction("ready", () => markContractReadyAction(contractId))} disabled={busy === "ready"}>
                    {busy === "ready" ? "Marking…" : "Mark Ready"}
                  </Button>
                ) : null}
                {builderState.status !== "archived" ? (
                  <Button variant="secondary" onClick={() => runAction("archive", () => archiveContractDocumentAction(contractId))} disabled={busy === "archive"}>
                    {busy === "archive" ? "Archiving…" : "Archive Document"}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>

          <div>
            <h4 className="text-xs font-medium uppercase tracking-wide text-text-muted">Version History</h4>
            <ul className="mt-2 space-y-1.5 text-sm text-text">
              {builderState.versions.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-2">
                  <span>
                    v{v.version_number}
                    {v.id === builderState.current_version_id ? <span className="ml-1.5 text-xs text-accent">(current)</span> : null}
                    <span className="ml-1.5 text-xs text-text-muted">{new Date(v.created_at).toLocaleDateString()}</span>
                  </span>
                  {canManage && v.id !== builderState.current_version_id ? (
                    <Button variant="ghost" onClick={() => runAction(`restore_${v.id}`, () => restoreContractVersionAction(contractId, v.id))} disabled={busy === `restore_${v.id}`}>
                      {busy === `restore_${v.id}` ? "Restoring…" : "Restore"}
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>

            {builderState.versions.length > 1 ? (
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <div>
                  <label className="mb-1 block text-xs text-text-muted">Compare A</label>
                  <Select value={compareA ?? ""} onChange={(e) => setCompareA(e.target.value ? Number(e.target.value) : null)} className="max-w-[8rem]">
                    <option value="">—</option>
                    {builderState.versions.map((v) => (
                      <option key={v.id} value={v.version_number}>
                        v{v.version_number}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-text-muted">Compare B</label>
                  <Select value={compareB ?? ""} onChange={(e) => setCompareB(e.target.value ? Number(e.target.value) : null)} className="max-w-[8rem]">
                    <option value="">—</option>
                    {builderState.versions.map((v) => (
                      <option key={v.id} value={v.version_number}>
                        v{v.version_number}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button variant="secondary" onClick={handleCompare} disabled={compareA === null || compareB === null || busy === "compare"}>
                  {busy === "compare" ? "Comparing…" : "Compare"}
                </Button>
              </div>
            ) : null}

            {comparison ? (
              <div className="mt-3 rounded-md border border-border p-3">
                <p className="text-xs font-medium text-text">
                  v{comparison.versionANumber} → v{comparison.versionBNumber} {comparison.hasChanges ? "" : "(no changes)"}
                </p>
                <ul className="mt-1.5 space-y-1 text-xs text-text-muted">
                  {comparison.diffs.map((d, i) => (
                    <li key={i}>
                      [{d.category}] {d.field}: {d.changeType}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          {canManage ? (
            <div>
              <h4 className="text-xs font-medium uppercase tracking-wide text-text-muted">New Version</h4>
              <div className="mt-2 space-y-2">
                <div>
                  <label className="mb-1 block text-xs text-text-muted">Terms</label>
                  <Textarea value={terms} onChange={(e) => setTerms(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-text-muted">Policies</label>
                  <Textarea value={policies} onChange={(e) => setPolicies(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-text-muted">Notes</label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
                <Button onClick={handleNewVersion} disabled={busy === "version"}>
                  {busy === "version" ? "Saving…" : "Save New Version"}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </Card>
  );
}
