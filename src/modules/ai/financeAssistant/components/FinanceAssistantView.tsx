"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Toast } from "@/components/ui/Toast";
import { registerSkillRunner, unregisterSkillRunner } from "@/core/ai/skills/runnerRegistry";
import { generateFinanceAssistantBrief } from "@/modules/ai/financeAssistant/generateFinanceAssistantBrief";
import { FINANCE_ASSISTANT_SKILL_ID } from "@/modules/ai/financeAssistant/registerFinanceAssistantSkill";
import { formatMoney } from "@/lib/money";
import type { GeneratedFinanceAssistantBrief, FinanceAssistantResolvedAction, FinanceAssistantInvoiceSummary } from "@/modules/ai/financeAssistant/types";

type ViewStatus = "idle" | "loading" | "success" | "error";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function toPlainText(result: GeneratedFinanceAssistantBrief): string {
  const { brief } = result;
  const lines: string[] = [
    "FINANCE ASSISTANT REPORT",
    formatDateTime(result.generatedAt),
    "",
    "EXECUTIVE SUMMARY",
    brief.executiveSummary,
    "",
    "REVENUE OVERVIEW",
    brief.revenueOverview.summary,
    "",
    "CASH FLOW SNAPSHOT",
    brief.cashFlowSnapshot.summary,
  ];
  if (brief.financialRisks.length > 0) {
    lines.push("", "FINANCIAL RISKS", ...brief.financialRisks.map((risk) => `- ${risk.risk.label}: ${risk.explanation ?? risk.risk.reasons.join(", ")}`));
  }
  if (brief.recommendations.length > 0) {
    lines.push("", "RECOMMENDATIONS", ...brief.recommendations.map((action) => `- ${action.label}: ${action.reason}`));
  }
  return lines.join("\n");
}

/**
 * The Finance Assistant's own dedicated page (Checkpoint 8) — a standalone
 * route rather than a `/dashboard`-embedded card, mirroring
 * `CRMAssistantView.tsx`'s own precedent: this Skill's context spans
 * Invoices/Payments/Contracts/Proposals/Events/Memory/CRM in one report,
 * too broad for a shared dashboard card. Never imports the provider
 * registry or a provider implementation directly; every action here calls
 * a `"use server"` Server Action, which is the only place a provider is
 * ever invoked (see `generateFinanceAssistantBrief.ts`).
 */
export function FinanceAssistantView() {
  const [status, setStatus] = useState<ViewStatus>("idle");
  const [result, setResult] = useState<GeneratedFinanceAssistantBrief | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copyToast, setCopyToast] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  async function handleGenerate() {
    if (status === "loading") return; // duplicate-submit prevention
    setStatus("loading");
    setErrorMessage(null);

    const outcome = await generateFinanceAssistantBrief();
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

  // Lets "Open Finance Assistant" (Checkpoint 8, Step 9) run this page's own
  // generation when picked from the Ask Bloom picker while this page is
  // mounted — same pattern `CRMAssistantView`/`BloomAIOverviewView` already
  // established for their own Skills.
  useEffect(() => {
    registerSkillRunner(FINANCE_ASSISTANT_SKILL_ID, () => {
      headingRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
      headingRef.current?.focus();
      return handleGenerateRef.current();
    });
    return () => unregisterSkillRunner(FINANCE_ASSISTANT_SKILL_ID);
  }, []);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 ref={headingRef} tabIndex={-1} className="font-serif text-3xl font-semibold text-text">
            Finance Assistant
          </h2>
          <p className="mt-1 max-w-prose text-sm text-text-muted">
            Bloom AI reads this Workspace&apos;s Invoices, Payments, Contracts, Events, and its own AI Memory to surface
            revenue, outstanding balances, cash flow, and financial risk. It never moves money or changes any record —
            review every suggestion before acting on it.
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={handleGenerate} disabled={status === "loading"} aria-label={result ? "Refresh Finance report" : "Generate Finance report"}>
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

        {status === "idle" ? <p className="text-sm text-text/55">No Finance report has been generated yet.</p> : null}

        {status === "success" && result ? <FinanceReport result={result} onCopy={handleCopy} /> : null}
      </div>

      {copyToast ? <Toast tone="success" message="Finance report copied to clipboard." onDismiss={() => setCopyToast(false)} /> : null}
    </div>
  );
}

function InvoiceList({ title, headingId, invoices, emptyLabel }: { title: string; headingId: string; invoices: FinanceAssistantInvoiceSummary[]; emptyLabel: string }) {
  return (
    <Card>
      <h3 id={headingId} className="font-serif text-[17px] font-semibold text-text">
        {title}
      </h3>
      {invoices.length === 0 ? (
        <p className="mt-2 text-sm text-text/55">{emptyLabel}</p>
      ) : (
        <ul className="mt-3 space-y-1.5" aria-labelledby={headingId}>
          {invoices.map((invoice) => (
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

function ActionList({ title, headingId, actions, emptyLabel }: { title: string; headingId: string; actions: FinanceAssistantResolvedAction[]; emptyLabel: string }) {
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

function FinanceReport({ result, onCopy }: { result: GeneratedFinanceAssistantBrief; onCopy: () => void }) {
  const { brief } = result;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
        <span>Generated {formatDateTime(result.generatedAt)}</span>
        <Badge tone={result.mock ? "outline" : "accent"}>{result.mock ? "Development mock — not a real AI call" : "AI-generated"}</Badge>
        <span>Confidence: {brief.confidence}%</span>
        <Button type="button" variant="ghost" onClick={onCopy} aria-label="Copy Finance report as text">
          Copy
        </Button>
      </div>

      <Card>
        <h3 id="finance-executive-summary-heading" className="font-serif text-[17px] font-semibold text-text">
          Executive Summary
        </h3>
        <p className="mt-2 text-sm text-text" aria-labelledby="finance-executive-summary-heading">
          {brief.executiveSummary}
        </p>
      </Card>

      <RevenueOverviewCard brief={brief} />
      <CashFlowSnapshotCard brief={brief} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <InvoiceList title="Outstanding Payments" headingId="finance-outstanding-heading" invoices={brief.outstandingPayments} emptyLabel="No outstanding payments right now." />
        <InvoiceList title="Upcoming Revenue" headingId="finance-upcoming-heading" invoices={brief.upcomingRevenue} emptyLabel="No revenue expected in the next 30 days." />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <InvoiceList title="Payment Delays" headingId="finance-delays-heading" invoices={brief.paymentDelays} emptyLabel="No overdue payments right now." />
        <FinancialRisksCard brief={brief} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ContractValueCard brief={brief} />
        <ActionList title="Revenue Opportunities" headingId="finance-opportunities-heading" actions={brief.revenueOpportunities} emptyLabel="No opportunities surfaced right now." />
      </div>

      <ActionList title="Recommendations" headingId="finance-recommendations-heading" actions={brief.recommendations} emptyLabel="No recommendations right now." />

      <RecentAIInsightsCard brief={brief} />

      {brief.missingInformation.length > 0 ? (
        <Card>
          <h3 id="finance-missing-info-heading" className="font-serif text-[17px] font-semibold text-text">
            Missing Information
          </h3>
          <ul className="mt-2 list-inside list-disc text-sm text-text" aria-labelledby="finance-missing-info-heading">
            {brief.missingInformation.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

function RevenueOverviewCard({ brief }: { brief: GeneratedFinanceAssistantBrief["brief"] }) {
  const revenue = brief.revenueOverview;
  return (
    <Card>
      <h3 id="finance-revenue-overview-heading" className="font-serif text-[17px] font-semibold text-text">
        Revenue Overview
      </h3>
      <p className="mt-1 text-sm text-text-muted">{revenue.summary}</p>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Revenue This Month" value={formatMoney(revenue.revenueThisMonthMinor, revenue.currency)} />
        <Stat label="Collected This Month" value={formatMoney(revenue.collectedThisMonthMinor, revenue.currency)} />
        <Stat label="Total Invoiced" value={formatMoney(revenue.totalInvoicedAllTimeMinor, revenue.currency)} />
        <Stat label="Total Collected" value={formatMoney(revenue.totalCollectedAllTimeMinor, revenue.currency)} />
      </div>
    </Card>
  );
}

function CashFlowSnapshotCard({ brief }: { brief: GeneratedFinanceAssistantBrief["brief"] }) {
  const cashFlow = brief.cashFlowSnapshot;
  return (
    <Card>
      <h3 id="finance-cash-flow-heading" className="font-serif text-[17px] font-semibold text-text">
        Cash Flow Snapshot
      </h3>
      <p className="mt-1 text-sm text-text-muted">{cashFlow.summary}</p>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Collected" value={formatMoney(cashFlow.collectedMinor, cashFlow.currency)} />
        <Stat label="Outstanding" value={formatMoney(cashFlow.outstandingMinor, cashFlow.currency)} />
        <Stat label="Upcoming" value={formatMoney(cashFlow.upcomingMinor, cashFlow.currency)} />
        <Stat label="Refunded" value={formatMoney(cashFlow.refundedMinor, cashFlow.currency)} />
        <Stat label="Expenses" value={formatMoney(cashFlow.expensesMinor, cashFlow.currency)} />
        <Stat label="Net Cash Position" value={formatMoney(cashFlow.netCashPositionMinor, cashFlow.currency)} />
      </div>
    </Card>
  );
}

function FinancialRisksCard({ brief }: { brief: GeneratedFinanceAssistantBrief["brief"] }) {
  return (
    <Card>
      <h3 id="finance-risks-heading" className="font-serif text-[17px] font-semibold text-text">
        Financial Risks
      </h3>
      {brief.financialRisks.length === 0 ? (
        <p className="mt-2 text-sm text-text/55">No financial risks identified right now.</p>
      ) : (
        <ul className="mt-3 space-y-2.5" aria-labelledby="finance-risks-heading">
          {brief.financialRisks.map((risk) => (
            <li key={risk.risk.riskId} className="text-sm text-text">
              <p className="font-medium">{risk.risk.label}</p>
              <p className="text-text-muted">{risk.explanation ?? risk.risk.reasons.join("; ")}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ContractValueCard({ brief }: { brief: GeneratedFinanceAssistantBrief["brief"] }) {
  const value = brief.contractValue;
  return (
    <Card>
      <h3 id="finance-contract-value-heading" className="font-serif text-[17px] font-semibold text-text">
        Contract Value
      </h3>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <Stat label="Total" value={formatMoney(value.totalMinor, value.currency)} />
        <Stat label="Signed" value={formatMoney(value.signedMinor, value.currency)} />
        <Stat label="Unsigned" value={formatMoney(value.unsignedMinor, value.currency)} />
      </div>
    </Card>
  );
}

function RecentAIInsightsCard({ brief }: { brief: GeneratedFinanceAssistantBrief["brief"] }) {
  if (brief.relevantMemories.length === 0 && brief.crmRecommendations.length === 0) return null;
  return (
    <Card>
      <h3 id="finance-insights-heading" className="font-serif text-[17px] font-semibold text-text">
        Recent AI Insights
      </h3>
      <p className="mt-1 text-sm text-text-muted">Approved memory and CRM Assistant recommendations — informational only.</p>
      {brief.crmRecommendations.length > 0 ? (
        <ul className="mt-3 space-y-1.5" aria-labelledby="finance-insights-heading">
          {brief.crmRecommendations.map((rec) => (
            <li key={rec.clientId} className="text-sm text-text">
              <Link href={`/clients/${rec.clientId}`} className="font-medium text-accent hover:underline">
                {rec.name}
              </Link>
              <span className="text-text-muted"> — {rec.reasons.join("; ")}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {brief.relevantMemories.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {brief.relevantMemories.map((memory) => (
            <li key={memory.id} className="text-sm text-text">
              <p className="font-medium">{memory.title}</p>
              <p className="text-text-muted">{memory.summary}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-lg font-semibold tabular-nums text-text">{value}</div>
      <div className="text-xs text-text-muted uppercase tracking-wide">{label}</div>
    </div>
  );
}
