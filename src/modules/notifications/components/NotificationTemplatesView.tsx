"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { listNotificationTemplatesAction, getNotificationTemplateDetailAction, type NotificationTemplateDetail } from "@/modules/notifications/notificationPlatformActions";
import type { NotificationTemplate } from "@/types/notificationPlatform";
import type { NotificationPriority } from "@/core/notifications/types";

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; templates: NotificationTemplate[] };

const PRIORITY_TONE: Record<NotificationPriority, BadgeTone> = { low: "outline", normal: "outline", high: "warning", critical: "danger" };

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/**
 * v2.0 Checkpoint 41, Step 16 — Template Library at `/notifications/templates`.
 * Read-only, as the checkpoint's own spec calls for — see
 * `templateStore.ts`'s doc comment for why: `createNotificationTemplateAction`
 * is real infrastructure (Step 11), but no create/edit form is wired to
 * this view this checkpoint. Selecting a template loads its version
 * history and a preview of its (illustrative, non-merge-field) title/body
 * text.
 */
export function NotificationTemplatesView() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [selected, setSelected] = useState<NotificationTemplateDetail | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  useEffect(() => {
    listNotificationTemplatesAction().then((result) => {
      if (result.success) setState({ status: "ready", templates: result.data });
      else setState({ status: "error", message: result.error });
    });
  }, []);

  async function selectTemplate(id: string) {
    const result = await getNotificationTemplateDetailAction(id);
    if (result.success) setSelected(result.data);
  }

  if (state.status === "loading") {
    return (
      <div>
        <PageHeader title="Notification Templates" breadcrumb={[{ label: "Notifications", href: "/notifications" }, { label: "Templates" }]} />
        <TableSkeleton rows={6} columns={3} />
      </div>
    );
  }
  if (state.status === "error") return <ErrorState message={state.message} />;

  const categories = Array.from(new Set(state.templates.map((t) => t.category)));
  const visible = categoryFilter ? state.templates.filter((t) => t.category === categoryFilter) : state.templates;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Notification Templates" subtitle="The system template every notification kind is built from — read-only." breadcrumb={[{ label: "Notifications", href: "/notifications" }, { label: "Templates" }]} />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCategoryFilter(null)}
          className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${categoryFilter === null ? "bg-accent text-accent-foreground" : "bg-surface-hover text-text-muted"}`}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategoryFilter(c)}
            className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${categoryFilter === c ? "bg-accent text-accent-foreground" : "bg-surface-hover text-text-muted"}`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <ul className="divide-y divide-border text-sm">
            {visible.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => selectTemplate(t.id)} className="flex w-full items-center justify-between gap-2 py-2 text-left hover:text-accent">
                  <span className="text-text">{t.name}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Badge tone={PRIORITY_TONE[t.defaultPriority]}>{t.defaultPriority}</Badge>
                    <span className="text-xs text-text-muted capitalize">{t.category}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          {selected ? (
            <div className="space-y-3">
              <div>
                <h3 className="font-serif text-base font-semibold text-text">{selected.template.name}</h3>
                <p className="mt-1 text-sm text-text-muted">{selected.template.description}</p>
              </div>
              <div className="space-y-1 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Preview</p>
                <p className="rounded-md border border-border/60 p-2 text-text">{selected.template.titleTemplate}</p>
                <p className="rounded-md border border-border/60 p-2 text-text-muted">{selected.template.bodyTemplate}</p>
              </div>
              <div className="space-y-1 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Version history</p>
                <ul className="divide-y divide-border">
                  {selected.history.map((v) => (
                    <li key={v.version} className="flex items-center justify-between gap-2 py-1">
                      <span className="text-text">v{v.version}</span>
                      <span className="text-xs text-text-muted">{formatDateTime(v.changedAt)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <p className="text-sm text-text-muted">Select a template to preview it.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
