"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMemberSession } from "@/components/providers/MemberSessionProvider";
import { useCopilotPanel } from "@/modules/ai/copilot/CopilotProvider";
import { useCopilotPageContext } from "@/modules/ai/copilot/CopilotPageContextProvider";
import { useDialogBehavior } from "@/components/ui/useDialogBehavior";
import { getCommands } from "@/core/commandPalette/registry";
import { filterCommands } from "@/core/commandPalette/filter";
import { runSearch } from "@/core/search/pipeline";
import { resolveDashboardExperience } from "@/core/dashboard/resolveDashboardExperience";
import { generateExecutiveBrief } from "@/modules/ai/copilot/briefs/generateExecutiveBrief";
import { generateTeamBrief } from "@/modules/ai/copilot/briefs/generateTeamBrief";
import { getCommunicationBriefAction } from "@/modules/ai/copilot/briefs/getCommunicationBriefAction";
import { getCopilotSuggestions } from "@/modules/ai/copilot/getCopilotSuggestions";
import { runCopilotAction } from "@/modules/ai/copilot/runCopilotAction";
import { registerDefaultCopilotCommands } from "@/modules/ai/copilot/registerCopilotCommands";
import { registerDefaultCommunicationCommands } from "@/modules/communication/registerCommunicationCommands";
import { logCopilotActivity } from "@/modules/ai/copilot/activityLog";
import { CloseIcon, BloomAiIcon } from "@/components/ui/icons";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import type { ExecutiveBrief, TeamBrief, BriefLine, CommunicationBrief } from "@/modules/ai/copilot/briefs/types";
import type { CopilotSuggestion } from "@/core/ai/copilot/suggestionEngine";
import type { CommandAction } from "@/core/commandPalette/types";
import type { SearchResult } from "@/core/search/types";

registerDefaultCopilotCommands();
registerDefaultCommunicationCommands();

type BriefState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; brief: ExecutiveBrief | TeamBrief; kind: "executive" | "team" }
  | { status: "error" };

type SuggestionsState = { status: "idle" } | { status: "loading" } | { status: "ready"; items: CopilotSuggestion[] };

const TONE_TO_BADGE: Record<BriefLine["tone"], BadgeTone> = { info: "outline", success: "success", warning: "warning" };

/**
 * Checkpoint 20, Step 1 — the Global Bloom AI Copilot. A side panel
 * (edge-anchored, same dialog mechanics `Drawer.tsx` and `CommandPalette.tsx`
 * already establish), never a route change — the page underneath stays
 * exactly as it was. Reads `useCopilotPageContext()` for Step 2's "never ask
 * for information already on screen," and composes four already-built
 * pieces (Command Registry + Universal Search, the Brief generators, the
 * Suggestion Engine, the Action Executor) rather than inventing a second
 * mechanism for any of them.
 */
export function CopilotPanel() {
  const { open, closePanel } = useCopilotPanel();
  const pageContext = useCopilotPageContext();
  const session = useMemberSession();
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogBehavior({ open, onClose: closePanel, containerRef: panelRef, lockScroll: true });

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [briefState, setBriefState] = useState<BriefState>({ status: "idle" });
  const [suggestionsState, setSuggestionsState] = useState<SuggestionsState>({ status: "idle" });
  const [runningActionId, setRunningActionId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  function close() {
    closePanel();
    setQuery("");
    setSearchResults([]);
  }

  // Lazy-load (Step 19): the Brief only fetches once, the first time the
  // panel is opened — not on every mount, and not while closed. No
  // synchronous `setState` at the top of this effect (the exact
  // cascading-render pattern this project's lint config forbids, per
  // `BloomAISkillPicker`'s own precedent) — `briefState` simply stays
  // `"idle"` (which `CopilotBriefSection` already renders identically to
  // `"loading"`) until the async work resolves.
  useEffect(() => {
    if (!open || briefState.status !== "idle") return;
    if (session.status !== "active" || !session.workspace || !session.role) return;
    let cancelled = false;
    const experience = resolveDashboardExperience(session.role);
    const firstName = session.profile?.full_name?.trim().split(/\s+/)[0] ?? null;
    const promise =
      experience === "owner"
        ? generateExecutiveBrief(session.workspace.id, firstName).then((brief) => ({ brief, kind: "executive" as const }))
        : generateTeamBrief(session.workspace.id, session.user?.id ?? "", firstName, session.profile?.full_name ?? null).then((brief) => ({
            brief,
            kind: "team" as const,
          }));
    promise.then(
      (result) => {
        if (!cancelled) setBriefState({ status: "ready", brief: result.brief, kind: result.kind });
      },
      () => {
        if (!cancelled) setBriefState({ status: "error" });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [open, briefState.status, session]);

  useEffect(() => {
    if (!open) return;
    const pageModule = pageContext?.module ?? null;
    let cancelled = false;
    if (!pageModule || session.status !== "active" || !session.workspace) {
      Promise.resolve().then(() => {
        if (!cancelled) setSuggestionsState({ status: "ready", items: [] });
      });
      return () => {
        cancelled = true;
      };
    }
    getCopilotSuggestions(pageModule, session.workspace.id).then((items) => {
      if (!cancelled) setSuggestionsState({ status: "ready", items });
    });
    return () => {
      cancelled = true;
    };
  }, [open, pageContext?.module, session]);

  useEffect(() => {
    if (!open || !session.workspace) return;
    let cancelled = false;
    const term = query.trim();
    const search = term === "" ? Promise.resolve<SearchResult[]>([]) : runSearch({ workspaceId: session.workspace.id, term, limit: 6 });
    search.then((results) => {
      if (!cancelled) setSearchResults(results);
    });
    return () => {
      cancelled = true;
    };
  }, [open, session.workspace, query]);

  async function handleRunAction(suggestion: CopilotSuggestion) {
    if (!suggestion.actionId) return;
    setRunningActionId(suggestion.id);
    setActionMessage(null);
    const result = await runCopilotAction(suggestion.actionId, suggestion.actionFacts);
    setRunningActionId(null);
    setActionMessage(result.success ? result.data.message : result.error);
    if (session.status === "active" && session.workspace && session.user) {
      logCopilotActivity(session.workspace.id, session.user.id, "suggestion_accepted", suggestion.label);
    }
  }

  function handleDismissSuggestion(suggestion: CopilotSuggestion) {
    if (suggestionsState.status !== "ready") return;
    setSuggestionsState({ status: "ready", items: suggestionsState.items.filter((item) => item.id !== suggestion.id) });
    if (session.status === "active" && session.workspace && session.user) {
      logCopilotActivity(session.workspace.id, session.user.id, "suggestion_ignored", suggestion.label);
    }
  }

  if (!open) return null;

  const commands = filterCommands(getCommands(), query);

  return (
    <div className="fixed inset-0 z-[var(--z-index-modal)] flex justify-end">
      <button type="button" aria-label="Close Bloom AI" onClick={close} className="animate-fade-in absolute inset-0 bg-neutral-800/50" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Bloom AI"
        tabIndex={-1}
        className="bloom-elevation-modal animate-drawer-in relative flex h-full w-full max-w-[440px] flex-col border-l border-border bg-surface focus:outline-none"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3.5">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-100">
              <BloomAiIcon className="h-4 w-4 text-accent" aria-hidden="true" />
            </span>
            <h2 className="font-serif text-lg font-semibold text-text">Bloom AI</h2>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close Bloom AI"
            className="flex h-9 w-9 items-center justify-center rounded-md text-text-muted transition-colors duration-150 hover:bg-text/7 hover:text-text"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          {pageContext?.entity ? (
            <p className="rounded-md bg-surface-tint px-3 py-2 text-xs text-text-muted">
              Looking at <span className="font-medium text-text">{pageContext.entity.label}</span>
            </p>
          ) : null}

          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search or run a command…"
            aria-label="Search or run a command"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus-visible:border-accent focus-visible:outline-none"
          />

          {query.trim() !== "" ? (
            <CopilotSearchResults commands={commands} results={searchResults} onNavigate={close} />
          ) : (
            <>
              <CopilotBriefSection state={briefState} />
              <CopilotSuggestionsSection
                state={suggestionsState}
                runningActionId={runningActionId}
                onRun={handleRunAction}
                onDismiss={handleDismissSuggestion}
                message={actionMessage}
              />
              <CopilotCommunicationSection />
            </>
          )}
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border px-4 py-3 text-xs">
          <Link href="/bloom-ai" onClick={close} className="text-accent hover:underline">
            Bloom AI Dashboard
          </Link>
          <Link href="/bloom-ai/writing-studio" onClick={close} className="text-accent hover:underline">
            Writing Studio
          </Link>
          <Link href="/bloom-ai/prompts" onClick={close} className="text-accent hover:underline">
            Prompt Library
          </Link>
          <Link href="/bloom-ai/memory" onClick={close} className="text-accent hover:underline">
            Memory &amp; Preferences
          </Link>
          <Link href="/bloom-ai/activity" onClick={close} className="text-accent hover:underline">
            Activity History
          </Link>
        </div>
      </div>
    </div>
  );
}

function CopilotBriefSection({ state }: { state: BriefState }) {
  if (state.status === "idle" || state.status === "loading") {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }
  if (state.status === "error") {
    return <p className="text-sm text-danger">Your brief isn&apos;t available right now.</p>;
  }

  const { brief } = state;
  return (
    <section className="animate-fade-up space-y-2.5">
      <p className="font-serif text-base font-semibold text-text">{brief.greeting}</p>
      <p className="text-sm text-text-muted">{brief.summary}</p>
      <ul className="space-y-1.5">
        {brief.lines.map((line) => (
          <li key={line.id} className="flex items-start gap-2 text-sm text-text">
            <Badge tone={TONE_TO_BADGE[line.tone]} className="mt-0.5 shrink-0" aria-hidden="true">
              {line.tone === "warning" ? "!" : line.tone === "success" ? "✓" : "•"}
            </Badge>
            <span>{line.text}</span>
          </li>
        ))}
      </ul>
      {state.kind === "executive" ? (
        <div className="rounded-md bg-surface-tint p-3">
          <p className="text-xs font-medium tracking-wide text-text-muted uppercase">Recommendations</p>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-text">
            {(state.brief as ExecutiveBrief).recommendations.map((recommendation) => (
              <li key={recommendation}>{recommendation}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

type CommunicationBriefState = { status: "idle" } | { status: "loading" } | { status: "ready"; brief: CommunicationBrief } | { status: "error" };

/** v2.0 Checkpoint 24, Step 14 — Bloom AI Communication Intelligence. Self-fetching (its own small state machine, not woven into `briefState`) since it reads a wholly separate domain (notifications/reminders/threads) from the Executive/Team Brief above it. */
function CopilotCommunicationSection() {
  const [state, setState] = useState<CommunicationBriefState>({ status: "idle" });

  useEffect(() => {
    let cancelled = false;
    getCommunicationBriefAction().then((result) => {
      if (cancelled) return;
      if (result.success) setState({ status: "ready", brief: result.data });
      else setState({ status: "error" });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "idle" || state.status === "loading") {
    return (
      <div className="space-y-2 border-t border-border pt-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }
  if (state.status === "error") return null;

  const { brief } = state;
  return (
    <section className="animate-fade-up space-y-2 border-t border-border pt-3">
      <p className="text-xs font-medium tracking-wide text-text-muted uppercase">Communication</p>
      <p className="text-sm text-text-muted">{brief.summary}</p>
      <ul className="space-y-1.5">
        {brief.lines.map((line) => (
          <li key={line.id} className="flex items-start gap-2 text-sm text-text">
            <Badge tone={TONE_TO_BADGE[line.tone]} className="mt-0.5 shrink-0" aria-hidden="true">
              {line.tone === "warning" ? "!" : line.tone === "success" ? "✓" : "•"}
            </Badge>
            <span>{line.text}</span>
          </li>
        ))}
      </ul>
      <Link href="/communications" className="text-xs text-accent hover:underline">
        Open Notification Center
      </Link>
    </section>
  );
}

function CopilotSuggestionsSection({
  state,
  runningActionId,
  onRun,
  onDismiss,
  message,
}: {
  state: SuggestionsState;
  runningActionId: string | null;
  onRun: (suggestion: CopilotSuggestion) => void;
  onDismiss: (suggestion: CopilotSuggestion) => void;
  message: string | null;
}) {
  if (state.status === "idle") return null;
  if (state.status === "loading") {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }
  if (state.items.length === 0) return null;

  return (
    <section className="animate-fade-up space-y-2">
      <p className="text-xs font-medium tracking-wide text-text-muted uppercase">Suggestions</p>
      {message ? <p className="text-xs text-accent">{message}</p> : null}
      <ul className="space-y-1.5">
        {state.items.map((suggestion) => (
          <li key={suggestion.id} className="rounded-md border border-border/60 p-2.5">
            <p className="text-sm font-medium text-text">{suggestion.label}</p>
            <p className="mt-0.5 text-xs text-text-muted">{suggestion.description}</p>
            <div className="mt-1.5 flex items-center gap-3">
              {suggestion.actionId ? (
                <button
                  type="button"
                  onClick={() => onRun(suggestion)}
                  disabled={runningActionId === suggestion.id}
                  className="text-xs font-medium text-accent hover:underline disabled:opacity-60"
                >
                  {runningActionId === suggestion.id ? "Running…" : "Run"}
                </button>
              ) : null}
              <button type="button" onClick={() => onDismiss(suggestion)} className="text-xs text-text-muted hover:underline">
                Dismiss
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CopilotSearchResults({
  commands,
  results,
  onNavigate,
}: {
  commands: CommandAction[];
  results: SearchResult[];
  onNavigate: () => void;
}) {
  if (commands.length === 0 && results.length === 0) {
    return <p className="py-6 text-center text-sm text-text-muted">No results.</p>;
  }
  return (
    <div className="space-y-1">
      {commands.map((command) => (
        <button
          key={command.id}
          type="button"
          onClick={() => {
            onNavigate();
            void command.run();
          }}
          className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm text-text hover:bg-text/7"
        >
          <span>{command.label}</span>
          <span className="text-xs text-text-muted">{command.group}</span>
        </button>
      ))}
      {results.map((result) => (
        <Link
          key={`${result.entityType}-${result.entityId}`}
          href={result.route}
          onClick={onNavigate}
          className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm text-text hover:bg-text/7"
        >
          <span>{result.title}</span>
          <span className="text-xs text-text-muted">{result.entityType}</span>
        </Link>
      ))}
    </div>
  );
}
