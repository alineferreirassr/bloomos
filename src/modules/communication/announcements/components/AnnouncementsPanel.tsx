"use client";

import { useEffect, useState } from "react";
import { listActiveAnnouncementsAction, acknowledgeAnnouncementAction, publishAnnouncementAction } from "@/modules/communication/announcements/announcementActions";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Announcement, AnnouncementPriority } from "@/types/communication";

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; announcements: Announcement[] };

const PRIORITY_TONE: Record<AnnouncementPriority, BadgeTone> = { normal: "outline", important: "warning", critical: "danger" };

/** Compact ghost-button treatment for the row's action (Acknowledge) — same hover/active states as `Button variant="ghost"`, sized down for a single row. */
const ROW_ACTION_CLASS = "!px-2 !py-1 text-xs";

/** v2.0 Checkpoint 24, Step 8 — Announcements. `canPublish` gates the composer on `communications.manage` — resolved by whether `publishAnnouncementAction` itself succeeds/fails on first use, avoiding a second permissions round-trip just to decide whether to render a form. */
export function AnnouncementsPanel({ currentMemberId, canManage }: { currentMemberId: string; canManage: boolean }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState<AnnouncementPriority>("normal");

  const fetchData = () => {
    listActiveAnnouncementsAction().then((result) => {
      if (result.success) setState({ status: "ready", announcements: result.data });
      else setState({ status: "error", message: result.error });
    });
  };

  useEffect(fetchData, []);

  async function handlePublish() {
    if (title.trim().length === 0 || body.trim().length === 0) return;
    const result = await publishAnnouncementAction({ title, body, priority });
    if (result.success) {
      setTitle("");
      setBody("");
      setPriority("normal");
      fetchData();
    }
  }

  async function handleAcknowledge(id: string) {
    await acknowledgeAnnouncementAction(id);
    fetchData();
  }

  if (state.status === "loading") return <Skeleton className="h-48 w-full" />;
  if (state.status === "error") return <ErrorState message={state.message} onRetry={fetchData} />;

  return (
    <div className="space-y-4">
      {canManage ? (
        <div className="space-y-2 rounded-md border border-border p-3">
          <p className="text-sm font-medium text-text">New announcement</p>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text placeholder:text-text-muted focus-visible:border-accent focus-visible:outline-none"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Message"
            rows={2}
            className="w-full resize-none rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text placeholder:text-text-muted focus-visible:border-accent focus-visible:outline-none"
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as AnnouncementPriority)}
              className="w-full rounded-md border border-border bg-surface px-2 py-1 text-sm text-text sm:w-auto"
            >
              <option value="normal">Normal</option>
              <option value="important">Important</option>
              <option value="critical">Critical</option>
            </select>
            <Button onClick={handlePublish} disabled={title.trim().length === 0 || body.trim().length === 0} className="w-full sm:w-auto">
              Publish
            </Button>
          </div>
        </div>
      ) : null}

      {state.announcements.length === 0 ? (
        <EmptyState illustration="messages" title="No announcements" description="Workspace-wide announcements will appear here." />
      ) : (
        <div className="space-y-3">
          {state.announcements.map((a) => (
            <LuxuryCard key={a.id} className="p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={PRIORITY_TONE[a.priority]}>{a.priority}</Badge>
                <p className="text-sm font-semibold text-text">{a.title}</p>
              </div>
              <p className="mt-1 text-sm text-text-muted">{a.body}</p>
              <p className="mt-1 text-xs text-text-muted">By {a.author_name}</p>
              {a.requires_acknowledgement ? (
                a.acknowledged_member_ids.includes(currentMemberId) ? (
                  <Badge tone="success" className="mt-2">
                    Acknowledged
                  </Badge>
                ) : (
                  <Button type="button" variant="ghost" className={`mt-1 ${ROW_ACTION_CLASS}`} onClick={() => handleAcknowledge(a.id)}>
                    Acknowledge
                  </Button>
                )
              ) : null}
            </LuxuryCard>
          ))}
        </div>
      )}
    </div>
  );
}
