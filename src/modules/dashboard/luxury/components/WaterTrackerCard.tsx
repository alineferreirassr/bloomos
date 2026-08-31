"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Droplet, Minus, Plus } from "lucide-react";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { SectionHeader } from "@/modules/dashboard/luxury/components/SectionHeader";
import { PrivateToYouNotice } from "@/modules/dashboard/luxury/components/PrivateToYouNotice";
import { todayLocalDate } from "@/modules/dashboard/luxury/localDate";
import { DAILY_WATER_GOAL_GLASSES } from "@/types/wellness";
import { getMyWaterLogAction, addWaterGlassAction, removeWaterGlassAction } from "@/modules/dashboard/wellnessActions";

const LOAD_ERROR_MESSAGE = "Something went wrong. Please try again.";

/** One in-flight add (+1) or remove (-1), keyed by a unique id so it can be dropped from the ledger independently of any other write's outcome or settlement order. */
interface PendingWrite {
  id: number;
  delta: 1 | -1;
}

/**
 * Same self-only, browser-local-date, Server-Action-scoped shape as
 * `MoodCheckInCard` — see its own doc comment, including why the initial
 * read and every write are wrapped so a thrown/rejected call can never
 * leave `loading` stuck true forever or the glass count unconfirmed with
 * no feedback.
 *
 * Two distinct state domains, deliberately named differently so they're
 * never confused:
 *
 * - `baseGlasses` — an internal ALGEBRAIC bookkeeping value, never
 *   rendered directly. It's the last authoritative server read, plus the
 *   delta of every write that has since settled as a genuine success —
 *   merged WITHOUT clamping. It may be transiently negative purely as
 *   bookkeeping (e.g. a Remove settles success while a compensating,
 *   still-pending Add hasn't settled yet) — that's fine, since nothing
 *   ever reads `baseGlasses` on its own as a real count; it only ever
 *   participates in the one clamped sum below, and it always converges
 *   to a correct, non-negative value once every pending write has
 *   settled (the server itself refuses to let a real remove go below
 *   zero, so no reachable *fully-settled* state can end up negative).
 * - `glasses` — the one and only USER-VISIBLE value, `Math.max(0,
 *   baseGlasses + sum of still-pending writes' deltas)`. This is the
 *   single place clamping happens, applied fresh on every render.
 *
 * An earlier version of this file clamped `baseGlasses` itself at every
 * successful settlement (`Math.max(0, base + delta)`), which reintroduced
 * exactly the same information-loss bug this design exists to prevent,
 * just moved from the failure-rollback path to the success-merge path:
 * an exhaustive state-space check proved a concrete counterexample
 * (confirmed=0, an Add and a Remove both dispatched and both eventually
 * succeeding, with the Remove settling first) — clamping the intermediate
 * merge silently discarded the fact that the still-pending Add would
 * have brought the true value back to zero, and the final displayed
 * count came out wrong. Never clamp `baseGlasses` — only ever clamp the
 * derived `glasses` value.
 */
export function WaterTrackerCard({ privacyDetail, compact = false }: { privacyDetail?: string; compact?: boolean } = {}) {
  const [date] = useState(todayLocalDate);
  const [baseGlasses, setBaseGlasses] = useState(0);
  const [pendingWrites, setPendingWrites] = useState<PendingWrite[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const [, startTransition] = useTransition();
  const nextWriteIdRef = useRef(0);

  const glasses = Math.max(0, baseGlasses + pendingWrites.reduce((sum, write) => sum + write.delta, 0));

  useEffect(() => {
    let cancelled = false;
    getMyWaterLogAction(date)
      .then((log) => {
        if (cancelled) return;
        setBaseGlasses(log?.glasses ?? 0);
        setPendingWrites([]);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [date, retryToken]);

  function dispatchWrite(delta: 1 | -1, action: () => Promise<{ success: boolean }>) {
    const id = ++nextWriteIdRef.current;
    setPendingWrites((writes) => [...writes, { id, delta }]);
    setSaveError(false);
    startTransition(async () => {
      let succeeded: boolean;
      try {
        succeeded = (await action()).success;
      } catch {
        succeeded = false;
      }
      setPendingWrites((writes) => writes.filter((write) => write.id !== id));
      if (succeeded) {
        setBaseGlasses((base) => base + delta);
      } else {
        setSaveError(true);
      }
    });
  }

  function handleAdd() {
    dispatchWrite(1, () => addWaterGlassAction(date));
  }

  function handleRemove() {
    dispatchWrite(-1, () => removeWaterGlassAction(date));
  }

  return (
    <LuxuryCard padding={compact ? "compact" : "default"}>
      <SectionHeader
        title="Water Tracker"
        action={
          <span className="text-luxury-small font-medium text-luxury-text-muted">
            {glasses} of {DAILY_WATER_GOAL_GLASSES} glasses
          </span>
        }
      />
      {loadError ? (
        <div className="mt-2 flex items-center justify-between gap-3 rounded-luxury-md border border-luxury-border bg-luxury-surface px-3 py-2.5 text-luxury-small text-luxury-text-muted">
          <span>{LOAD_ERROR_MESSAGE}</span>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setLoadError(false);
              setRetryToken((t) => t + 1);
            }}
            className="font-medium text-luxury-rose underline-offset-2 hover:underline"
          >
            Retry
          </button>
        </div>
      ) : compact ? (
        // Compact: a fixed 4-per-row droplet grid (never an unpredictable flex-wrap
        // collapse into one tall column at narrow paired-column widths) with the
        // +/- controls in their own row beneath, so the card stays wide-and-short
        // rather than narrow-and-tall — a phone-specific internal composition, not
        // a shrunk copy of the desktop row.
        <div className="mt-2 flex flex-col items-center gap-2 lg:mt-1.5 lg:gap-1.5">
          <div className="grid grid-cols-4 gap-2 lg:gap-1.5" aria-hidden="true">
            {Array.from({ length: DAILY_WATER_GOAL_GLASSES }).map((_, index) => (
              <Droplet
                key={index}
                className={`h-[18px] w-[18px] transition-all duration-200 lg:h-4 lg:w-4 ${index < glasses ? "fill-luxury-rose text-luxury-rose" : "fill-transparent text-luxury-beige"}`}
                strokeWidth={1.75}
              />
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleRemove}
              disabled={loading || glasses === 0}
              aria-label="Remove a glass"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-luxury-full border border-luxury-rose/30 text-luxury-rose transition-colors duration-150 hover:border-luxury-rose hover:bg-luxury-rose hover:text-luxury-rose-foreground focus-visible:outline-none focus-visible:[box-shadow:var(--luxury-focus-ring)] disabled:opacity-30 lg:h-8 lg:w-8"
            >
              <Minus className="h-4 w-4" aria-hidden="true" strokeWidth={2.5} />
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={loading}
              aria-label="Add a glass"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-luxury-full border border-luxury-rose/30 text-luxury-rose transition-colors duration-150 hover:border-luxury-rose hover:bg-luxury-rose hover:text-luxury-rose-foreground focus-visible:outline-none focus-visible:[box-shadow:var(--luxury-focus-ring)] disabled:opacity-30 lg:h-8 lg:w-8"
            >
              <Plus className="h-4 w-4" aria-hidden="true" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleRemove}
            disabled={loading || glasses === 0}
            aria-label="Remove a glass"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-luxury-full border border-luxury-rose/30 text-luxury-rose transition-colors duration-150 hover:border-luxury-rose hover:bg-luxury-rose hover:text-luxury-rose-foreground focus-visible:outline-none focus-visible:[box-shadow:var(--luxury-focus-ring)] disabled:opacity-30"
          >
            <Minus className="h-4 w-4" aria-hidden="true" strokeWidth={2.5} />
          </button>
          <div className="flex flex-1 flex-wrap justify-center gap-1.5" aria-hidden="true">
            {Array.from({ length: DAILY_WATER_GOAL_GLASSES }).map((_, index) => (
              <Droplet
                key={index}
                className={`h-5 w-5 transition-all duration-200 ${index < glasses ? "fill-luxury-rose text-luxury-rose" : "fill-transparent text-luxury-beige"}`}
                strokeWidth={1.75}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={loading}
            aria-label="Add a glass"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-luxury-full border border-luxury-rose/30 text-luxury-rose transition-colors duration-150 hover:border-luxury-rose hover:bg-luxury-rose hover:text-luxury-rose-foreground focus-visible:outline-none focus-visible:[box-shadow:var(--luxury-focus-ring)] disabled:opacity-30"
          >
            <Plus className="h-4 w-4" aria-hidden="true" strokeWidth={2.5} />
          </button>
        </div>
      )}
      {saveError ? <p className="mt-1.5 text-luxury-small text-red-600">{LOAD_ERROR_MESSAGE}</p> : null}
      {compact ? null : <PrivateToYouNotice detail={privacyDetail ?? "Your mood and water tracker are not shared with Aline, managers, or other team members."} />}
    </LuxuryCard>
  );
}
