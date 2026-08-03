"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { ReportsIcon } from "@/components/ui/icons";
import { listReportTemplatesAction, createReportAction } from "@/modules/reporting/reportingActions";
import type { ReportTemplate } from "@/types/reporting";

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; templates: ReportTemplate[] };

/**
 * v2.0 Checkpoint 42, Step 15 — the Template Library at `/reports/templates`.
 * Every card is a pure definition over the one Report Computation Engine
 * (Step 7) — "Use template" creates a `SavedReport` from that definition
 * and navigates straight to its detail page; the Custom Report entry sends
 * the member to the Builder with a blank definition instead.
 */
export function ReportTemplatesView() {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [creating, setCreating] = useState<string | null>(null);

  useEffect(() => {
    listReportTemplatesAction().then((result) => {
      if (result.success) setState({ status: "ready", templates: result.data });
      else setState({ status: "error", message: result.error });
    });
  }, []);

  async function applyTemplate(template: ReportTemplate) {
    if (template.id === "custom") {
      router.push("/reports/builder");
      return;
    }
    setCreating(template.id);
    const result = await createReportAction({ ...template.definition, sourceTemplateId: template.id });
    setCreating(null);
    if (result.success) router.push(`/reports/${result.data.id}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Report Templates" subtitle="Start from a built-in template, or build your own from scratch." icon={ReportsIcon} />

      {state.status === "loading" ? <TableSkeleton rows={4} columns={3} /> : null}
      {state.status === "error" ? <ErrorState message={state.message} /> : null}
      {state.status === "ready" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {state.templates.map((template) => (
            <Card key={template.id} className="flex flex-col justify-between p-5">
              <div>
                <div className="flex items-center justify-between">
                  <p className="font-medium">{template.name}</p>
                  <Badge tone="outline">{template.category}</Badge>
                </div>
                <p className="mt-2 text-xs text-text-muted">{template.description}</p>
              </div>
              <Button variant="primary" className="mt-4" disabled={creating === template.id} onClick={() => applyTemplate(template)}>
                {template.id === "custom" ? "Start from scratch" : "Use template"}
              </Button>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
