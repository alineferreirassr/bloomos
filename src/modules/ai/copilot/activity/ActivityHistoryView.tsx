"use client";

import { useEffect, useState } from "react";
import { useMemberSession } from "@/components/providers/MemberSessionProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { listCopilotActivity } from "@/modules/ai/copilot/activityLog";
import type { AIMemoryEntry } from "@/types/aiMemory";

type LoadState = { status: "loading" } | { status: "ready"; entries: AIMemoryEntry[] };

/**
 * Checkpoint 20, Step 16 — AI Activity History. Searchable log of
 * Suggestions accepted/dismissed via the Copilot Panel — see
 * `activityLog.ts`'s own doc comment for what this deliberately does not
 * yet unify (Skill execution history, Writing Studio usage each already
 * have their own persistence elsewhere).
 */
export function ActivityHistoryView() {
  const session = useMemberSession();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (session.status !== "active" || !session.workspace || !session.user) return;
    listCopilotActivity(session.workspace.id, session.user.id).then((entries) => setState({ status: "ready", entries }));
  }, [session]);

  const entries = state.status === "ready" ? state.entries.filter((entry) => entry.summary.toLowerCase().includes(query.toLowerCase())) : [];

  return (
    <div>
      <PageHeader title="Activity History" subtitle="Suggestions you've accepted or dismissed from the Bloom AI Copilot." />

      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search activity…"
        aria-label="Search activity"
        className="mb-4 w-full max-w-sm rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text placeholder:text-text-muted focus-visible:border-accent focus-visible:outline-none"
      />

      {state.status === "loading" ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : entries.length === 0 ? (
        <p className="text-sm text-text-muted">No activity yet.</p>
      ) : (
        <ul className="space-y-2">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-surface p-3">
              <div>
                <p className="text-sm text-text">{entry.summary}</p>
                <p className="text-xs text-text-muted">{new Date(entry.created_at).toLocaleString()}</p>
              </div>
              <Badge tone={entry.title === "suggestion_accepted" ? "success" : "neutral"}>
                {entry.title === "suggestion_accepted" ? "Accepted" : "Dismissed"}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
