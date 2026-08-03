"use client";

import { useEffect, useState } from "react";
import { useMemberSession } from "@/components/providers/MemberSessionProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  saveCopilotPreference,
  listCopilotPreferences,
  COPILOT_PREFERENCE_KEYS,
  COPILOT_PREFERENCE_LABELS,
  type CopilotPreferenceKey,
} from "@/modules/ai/copilot/copilotPreferences";
import type { AIMemoryEntry } from "@/types/aiMemory";

type LoadState = { status: "loading" } | { status: "ready"; entries: AIMemoryEntry[] };

/**
 * Checkpoint 20, Step 17 — Bloom AI's own Memory & Preferences page. A
 * small, closed set of stylistic preferences (never sensitive information —
 * see `copilotPreferences.ts`'s own doc comment), stored via the existing
 * Memory Manager. Browsing the *general* Memory Layer (Skill-proposed
 * knowledge, review queue) already has its own surface — the `browse-ai-memory`
 * Skill on the Bloom AI Dashboard — this page is deliberately scoped to the
 * new preferences concept only, not a duplicate memory browser.
 */
export function MemoryPreferencesView() {
  const session = useMemberSession();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [key, setKey] = useState<CopilotPreferenceKey>("writing_tone");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (session.status !== "active" || !session.workspace || !session.user) return;
    listCopilotPreferences(session.workspace.id, session.user.id).then((entries) => setState({ status: "ready", entries }));
  }, [session]);

  async function handleSave() {
    if (session.status !== "active" || !session.workspace || !session.user || value.trim() === "") return;
    setSaving(true);
    await saveCopilotPreference(session.workspace.id, session.user.id, key, value.trim());
    const entries = await listCopilotPreferences(session.workspace.id, session.user.id);
    setState({ status: "ready", entries });
    setValue("");
    setSaving(false);
  }

  return (
    <div>
      <PageHeader title="Memory & Preferences" subtitle="What Bloom AI remembers about how you like to work — never anything sensitive." />

      <div className="mb-6 rounded-lg border border-border bg-surface p-4">
        <p className="mb-2 text-sm font-medium text-text">Add a preference</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select value={key} onChange={(event) => setKey(event.target.value as CopilotPreferenceKey)} className="sm:w-56">
            {COPILOT_PREFERENCE_KEYS.map((preferenceKey) => (
              <option key={preferenceKey} value={preferenceKey}>
                {COPILOT_PREFERENCE_LABELS[preferenceKey]}
              </option>
            ))}
          </Select>
          <input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="e.g. Warm and personal, never overly formal"
            className="flex-1 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text placeholder:text-text-muted focus-visible:border-accent focus-visible:outline-none"
          />
          <Button type="button" onClick={handleSave} disabled={saving || value.trim() === ""}>
            Save
          </Button>
        </div>
      </div>

      {state.status === "loading" ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : state.entries.length === 0 ? (
        <p className="text-sm text-text-muted">No preferences saved yet.</p>
      ) : (
        <ul className="space-y-2">
          {state.entries.map((entry) => (
            <li key={entry.id} className="rounded-md border border-border/60 bg-surface p-3">
              <p className="text-xs font-medium tracking-wide text-text-muted uppercase">
                {COPILOT_PREFERENCE_LABELS[entry.title as CopilotPreferenceKey] ?? entry.title}
              </p>
              <p className="mt-0.5 text-sm text-text">{entry.summary}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
