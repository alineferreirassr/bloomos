"use client";

import { useEffect, useState } from "react";
import { listMyRemindersAction, createReminderAction, completeReminderAction, dismissReminderAction, snoozeReminderAction } from "@/modules/communication/reminders/reminderActions";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Reminder, ReminderPriority } from "@/types/communication";

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; reminders: Reminder[] };

const PRIORITY_TONE: Record<ReminderPriority, BadgeTone> = { low: "outline", normal: "outline", high: "warning", critical: "danger" };

function toDatetimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** v2.0 Checkpoint 24, Step 9 — Reminder Engine's own UI: create, complete (which auto-reschedules a recurring reminder), dismiss, and snooze (+1 day, a simple fixed offset rather than a date picker, matching this checkpoint's own scope). */
export function RemindersPanel() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState(() => toDatetimeLocal(new Date(Date.now() + 3_600_000)));

  const fetchData = () => {
    listMyRemindersAction().then((result) => {
      if (result.success) setState({ status: "ready", reminders: result.data.filter((r) => r.status === "pending" || r.status === "snoozed") });
      else setState({ status: "error", message: result.error });
    });
  };

  useEffect(fetchData, []);

  async function handleCreate() {
    if (title.trim().length === 0) return;
    const result = await createReminderAction({ assignedToMemberId: "", title, dueAt: new Date(dueAt).toISOString() });
    if (result.success) {
      setTitle("");
      fetchData();
    }
  }

  if (state.status === "loading") return <Skeleton className="h-48 w-full" />;
  if (state.status === "error") return <ErrorState message={state.message} onRetry={fetchData} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2 rounded-md border border-border p-3">
        <div className="min-w-0 flex-1 space-y-1">
          <label htmlFor="reminder-title" className="text-xs text-text-muted">
            New reminder
          </label>
          <input
            id="reminder-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Follow up with…"
            className="w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text placeholder:text-text-muted focus-visible:border-accent focus-visible:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="reminder-due" className="text-xs text-text-muted">
            Due
          </label>
          <input id="reminder-due" type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-text" />
        </div>
        <Button onClick={handleCreate} disabled={title.trim().length === 0}>
          Add
        </Button>
      </div>

      {state.reminders.length === 0 ? (
        <EmptyState title="No reminders" description="Create a reminder above to see it here." />
      ) : (
        <ul className="space-y-2">
          {state.reminders.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 p-3">
              <div>
                <div className="flex items-center gap-2">
                  <Badge tone={PRIORITY_TONE[r.priority]}>{r.priority}</Badge>
                  {r.status === "snoozed" ? <Badge tone="outline">Snoozed</Badge> : null}
                  <p className="text-sm font-medium text-text">{r.title}</p>
                </div>
                <p className="text-xs text-text-muted">Due {new Date(r.status === "snoozed" && r.snoozed_until ? r.snoozed_until : r.due_at).toLocaleString()}</p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  className="text-xs text-accent hover:underline"
                  onClick={async () => {
                    await snoozeReminderAction(r.id, new Date(Date.now() + 24 * 3_600_000).toISOString());
                    fetchData();
                  }}
                >
                  Snooze 1 day
                </button>
                <button
                  type="button"
                  className="text-xs text-accent hover:underline"
                  onClick={async () => {
                    await completeReminderAction(r.id);
                    fetchData();
                  }}
                >
                  Complete
                </button>
                <button
                  type="button"
                  className="text-xs text-danger hover:underline"
                  onClick={async () => {
                    await dismissReminderAction(r.id);
                    fetchData();
                  }}
                >
                  Dismiss
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
