"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Toast } from "@/components/ui/Toast";
import { registerSkillRunner, unregisterSkillRunner } from "@/core/ai/skills/runnerRegistry";
import { generateCRMAssistantBrief } from "@/modules/ai/crmAssistant/generateCRMAssistantBrief";
import { CRM_ASSISTANT_SKILL_ID } from "@/modules/ai/crmAssistant/registerCRMAssistantSkill";
import { formatMoney } from "@/lib/money";
import type { GeneratedCrmAssistantBrief, CrmAssistantResolvedAction } from "@/modules/ai/crmAssistant/types";

type ViewStatus = "idle" | "loading" | "success" | "error";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function toPlainText(result: GeneratedCrmAssistantBrief): string {
  const { brief } = result;
  const lines: string[] = [
    "CRM ASSISTANT REPORT",
    formatDateTime(result.generatedAt),
    "",
    "EXECUTIVE SUMMARY",
    brief.executiveSummary,
    "",
    "RELATIONSHIP HEALTH",
    brief.relationshipHealth.summary,
  ];
  if (brief.clientsAtRisk.length > 0) {
    lines.push("", "CLIENTS AT RISK", ...brief.clientsAtRisk.map((risk) => `- ${risk.client.name}: ${risk.explanation ?? risk.client.reasons.join(", ")}`));
  }
  if (brief.recommendedActions.length > 0) {
    lines.push("", "RECOMMENDED ACTIONS", ...brief.recommendedActions.map((action) => `- ${action.label}: ${action.reason}`));
  }
  return lines.join("\n");
}

/**
 * The CRM Assistant's own dedicated page (Checkpoint 7) — a standalone
 * route rather than a `/dashboard`-embedded card (like Daily Brief), since
 * this Skill's own context spans Clients/Leads/Events/Contracts/Invoices/
 * Proposals/Memory in one report, too broad for a shared dashboard card.
 * Never imports the provider registry or a provider implementation
 * directly; every action here calls a `"use server"` Server Action, which
 * is the only place a provider is ever invoked
 * (see `generateCRMAssistantBrief.ts`).
 */
export function CRMAssistantView() {
  const [status, setStatus] = useState<ViewStatus>("idle");
  const [result, setResult] = useState<GeneratedCrmAssistantBrief | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copyToast, setCopyToast] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  async function handleGenerate() {
    if (status === "loading") return; // duplicate-submit prevention
    setStatus("loading");
    setErrorMessage(null);

    const outcome = await generateCRMAssistantBrief();
    if (!outcome.success) {
      setStatus("error");
      setErrorMessage(outcome.error);
      return;
    }
    setResult(outcome.data);
    setStatus("success");
  }

  async function handleCopy() {
    if (!result) return;
    await navigator.clipboard.writeText(toPlainText(result));
    setCopyToast(true);
  }

  const handleGenerateRef = useRef(handleGenerate);
  useEffect(() => {
    handleGenerateRef.current = handleGenerate;
  });

  // Lets "Open CRM Assistant" (Checkpoint 7, Step 9) run this page's own
  // generation when picked from the Ask Bloom picker while this page is
  // mounted — same pattern `DailyBriefCard`/`BloomAIOverviewView` already
  // established for their own Skills.
  useEffect(() => {
    registerSkillRunner(CRM_ASSISTANT_SKILL_ID, () => {
      headingRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
      headingRef.current?.focus();
      return handleGenerateRef.current();
    });
    return () => unregisterSkillRunner(CRM_ASSISTANT_SKILL_ID);
  }, []);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 ref={headingRef} tabIndex={-1} className="font-serif text-3xl font-semibold text-text">
            CRM Assistant
          </h2>
          <p className="mt-1 max-w-prose text-sm text-text-muted">
            Bloom AI reads this Workspace&apos;s Clients, Leads, Contracts, Payments, Events, and its own AI Memory to
            surface who needs attention, what&apos;s at risk, and what to prioritize next. It never sends anything or
            changes any record — review every suggestion before acting on it.
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={handleGenerate} disabled={status === "loading"} aria-label={result ? "Refresh CRM report" : "Generate CRM report"}>
          {status === "loading" ? "Generating…" : result ? "Refresh" : "Generate"}
        </Button>
      </div>

      <div aria-live="polite" className="mt-6">
        {status === "loading" ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : null}

        {status === "error" && errorMessage ? (
          <div role="alert" className="rounded-md border border-danger/60 bg-danger/10 px-4 py-2 text-sm text-danger">
            {errorMessage}
            <Button type="button" variant="ghost" onClick={handleGenerate} className="ml-2">
              Try again
            </Button>
          </div>
        ) : null}

        {status === "idle" ? <p className="text-sm text-text/55">No CRM report has been generated yet.</p> : null}

        {status === "success" && result ? <CrmReport result={result} onCopy={handleCopy} /> : null}
      </div>

      {copyToast ? <Toast tone="success" message="CRM report copied to clipboard." onDismiss={() => setCopyToast(false)} /> : null}
    </div>
  );
}

function ActionList({ title, headingId, actions, emptyLabel }: { title: string; headingId: string; actions: CrmAssistantResolvedAction[]; emptyLabel: string }) {
  return (
    <Card>
      <h3 id={headingId} className="font-serif text-[17px] font-semibold text-text">
        {title}
      </h3>
      {actions.length === 0 ? (
        <p className="mt-2 text-sm text-text/55">{emptyLabel}</p>
      ) : (
        <ul className="mt-3 space-y-2.5" aria-labelledby={headingId}>
          {actions.map((action) => (
            <li key={action.label} className="text-sm text-text">
              <p className="font-medium">{action.label}</p>
              <p className="text-text-muted">{action.reason}</p>
              {action.actionTarget ? (
                <Link href={action.actionTarget.href} className="text-xs font-medium text-accent hover:underline">
                  {action.actionTarget.label}
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function CrmReport({ result, onCopy }: { result: GeneratedCrmAssistantBrief; onCopy: () => void }) {
  const { brief } = result;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
        <span>Generated {formatDateTime(result.generatedAt)}</span>
        <Badge tone={result.mock ? "outline" : "accent"}>{result.mock ? "Development mock — not a real AI call" : "AI-generated"}</Badge>
        <span>Confidence: {brief.confidence}%</span>
        <Button type="button" variant="ghost" onClick={onCopy} aria-label="Copy CRM report as text">
          Copy
        </Button>
      </div>

      <Card>
        <h3 id="crm-executive-summary-heading" className="font-serif text-[17px] font-semibold text-text">
          Executive Summary
        </h3>
        <p className="mt-2 text-sm text-text" aria-labelledby="crm-executive-summary-heading">
          {brief.executiveSummary}
        </p>
      </Card>

      <RelationshipHealthCard brief={brief} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ClientRiskCard brief={brief} />
        <ActionList title="Upcoming Follow Ups" headingId="crm-follow-ups-heading" actions={brief.suggestedFollowUps} emptyLabel="No follow-ups suggested right now." />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ActionList title="Revenue Opportunities" headingId="crm-opportunities-heading" actions={brief.upcomingOpportunities} emptyLabel="No opportunities surfaced right now." />
        <ContractStatusCard brief={brief} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PaymentStatusCard brief={brief} />
        <ActionList title="Recommended Actions" headingId="crm-recommended-actions-heading" actions={brief.recommendedActions} emptyLabel="No recommendations right now." />
      </div>

      <RecentMemoriesCard brief={brief} />

      {brief.missingInformation.length > 0 ? (
        <Card>
          <h3 id="crm-missing-info-heading" className="font-serif text-[17px] font-semibold text-text">
            Missing Information
          </h3>
          <ul className="mt-2 list-inside list-disc text-sm text-text" aria-labelledby="crm-missing-info-heading">
            {brief.missingInformation.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

function RelationshipHealthCard({ brief }: { brief: GeneratedCrmAssistantBrief["brief"] }) {
  const health = brief.relationshipHealth;
  return (
    <Card>
      <h3 id="crm-relationship-health-heading" className="font-serif text-[17px] font-semibold text-text">
        Relationship Health
      </h3>
      <p className="mt-1 text-sm text-text-muted">{health.summary}</p>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Clients" value={health.totalClients} />
        <Stat label="Leads" value={health.totalLeads} />
        <Stat label="Priority" value={health.priorityClientCount} />
        <Stat label="Inactive" value={health.inactiveClientCount} />
        <Stat label="At Risk" value={health.atRiskClientCount} />
      </div>
      {brief.priorityClients.length > 0 ? (
        <div className="mt-4 border-t border-border pt-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-text-muted">Priority Clients</h4>
          <ul className="mt-2 space-y-1.5">
            {brief.priorityClients.slice(0, 8).map((client) => (
              <li key={client.clientId} className="flex items-center justify-between gap-2 text-sm">
                <Link href={`/clients/${client.clientId}`} className="text-accent hover:underline">
                  {client.name}
                </Link>
                {client.isVip ? <Badge tone="accent">VIP</Badge> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}

function ClientRiskCard({ brief }: { brief: GeneratedCrmAssistantBrief["brief"] }) {
  return (
    <Card>
      <h3 id="crm-client-risk-heading" className="font-serif text-[17px] font-semibold text-text">
        Client Risk
      </h3>
      {brief.clientsAtRisk.length === 0 ? (
        <p className="mt-2 text-sm text-text/55">No Clients currently at risk.</p>
      ) : (
        <ul className="mt-3 space-y-2.5" aria-labelledby="crm-client-risk-heading">
          {brief.clientsAtRisk.map((risk) => (
            <li key={risk.client.clientId} className="text-sm text-text">
              <Link href={`/clients/${risk.client.clientId}`} className="font-medium text-accent hover:underline">
                {risk.client.name}
              </Link>
              <p className="mt-0.5 text-text-muted">{risk.explanation ?? risk.client.reasons.join("; ")}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ContractStatusCard({ brief }: { brief: GeneratedCrmAssistantBrief["brief"] }) {
  return (
    <Card>
      <h3 id="crm-contract-status-heading" className="font-serif text-[17px] font-semibold text-text">
        Contract Status
      </h3>
      {brief.unsignedContracts.length === 0 ? (
        <p className="mt-2 text-sm text-text/55">No unsigned contracts right now.</p>
      ) : (
        <ul className="mt-3 space-y-1.5" aria-labelledby="crm-contract-status-heading">
          {brief.unsignedContracts.map((contract) => (
            <li key={contract.contractId} className="text-sm text-text">
              <Link href={`/contracts/${contract.contractId}`} className="text-accent hover:underline">
                Contract {contract.contractNumber}
              </Link>
              <span className="text-text-muted"> — {contract.signatureStatus}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function PaymentStatusCard({ brief }: { brief: GeneratedCrmAssistantBrief["brief"] }) {
  return (
    <Card>
      <h3 id="crm-payment-status-heading" className="font-serif text-[17px] font-semibold text-text">
        Payment Status
      </h3>
      <p className="mt-1 text-sm text-text-muted">
        {formatMoney(brief.outstandingBalanceMinor, brief.outstandingCurrency)} outstanding across {brief.outstandingPayments.length} invoice(s).
      </p>
      {brief.outstandingPayments.length === 0 ? (
        <p className="mt-2 text-sm text-text/55">No outstanding payments right now.</p>
      ) : (
        <ul className="mt-3 space-y-1.5" aria-labelledby="crm-payment-status-heading">
          {brief.outstandingPayments.map((invoice) => (
            <li key={invoice.invoiceId} className="flex justify-between text-sm text-text">
              <Link href={`/finance/invoices/${invoice.invoiceId}`} className="text-accent hover:underline">
                Invoice {invoice.invoiceNumber}
              </Link>
              <span className="tabular-nums">{formatMoney(invoice.balanceMinor, invoice.currency)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function RecentMemoriesCard({ brief }: { brief: GeneratedCrmAssistantBrief["brief"] }) {
  if (brief.relevantMemories.length === 0) return null;
  return (
    <Card>
      <h3 id="crm-recent-memories-heading" className="font-serif text-[17px] font-semibold text-text">
        Recent AI Recommendations
      </h3>
      <p className="mt-1 text-sm text-text-muted">Approved memory this Workspace has already vetted — informational only.</p>
      <ul className="mt-3 space-y-2" aria-labelledby="crm-recent-memories-heading">
        {brief.relevantMemories.map((memory) => (
          <li key={memory.id} className="text-sm text-text">
            <p className="font-medium">{memory.title}</p>
            <p className="text-text-muted">{memory.summary}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-2xl font-semibold tabular-nums text-text">{value}</div>
      <div className="text-xs text-text-muted uppercase tracking-wide">{label}</div>
    </div>
  );
}
