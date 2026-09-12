"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export interface ScheduleSubmitInput {
  /** A real UTC instant (`Date.prototype.toISOString()`), never a bare local-format string. */
  scheduledAt: string;
  scheduledTimezone: string;
}

interface SocialScheduleDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  submitLabel: string;
  /** The post's own currently-stored schedule, for Reschedule — omitted/null for a fresh Schedule. */
  initialScheduledAt?: string | null;
  initialScheduledTimezone?: string | null;
  onSubmit: (input: ScheduleSubmitInput) => Promise<{ success: boolean; error?: string }>;
}

/**
 * Renders the UTC instant `iso` back into the wall-clock date/time it would
 * show as in `timezone` — used to pre-populate Reschedule's inputs with the
 * post's own existing schedule, in the timezone it was originally scheduled
 * for (never the current browser timezone, which may differ).
 */
function splitLocalDateTime(iso: string, timezone: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

/** Resolves the browser's own IANA timezone — never assumed to be UTC, never guessed. */
function resolveBrowserTimezone(): string | null {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return zone || null;
  } catch {
    return null;
  }
}

/**
 * Interprets `date`/`time` (native `<input type="date"/"time">` values) as
 * wall-clock components in the BROWSER's own local timezone — the same
 * timezone `resolveBrowserTimezone()` reports — and returns the real UTC
 * instant that wall-clock time represents. `new Date(y, m, d, h, min)`
 * (the local-components constructor, not a string) is what makes this
 * correct: it's interpreted in the runtime's own local zone, exactly
 * matching what `resolveBrowserTimezone()` names, so `.toISOString()` on
 * the result is a genuine UTC conversion — never a bare "append Z" on a
 * local-format string, which would silently treat local time as UTC.
 */
function toUtcInstant(date: string, time: string): Date | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);
  if (!dateMatch || !timeMatch) return null;
  const [, year, month, day] = dateMatch;
  const [, hour, minute] = timeMatch;
  const local = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), 0, 0);
  return Number.isNaN(local.getTime()) ? null : local;
}

export function SocialScheduleDialog({ open, onClose, title, submitLabel, initialScheduledAt, initialScheduledTimezone, onSubmit }: SocialScheduleDialogProps) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Deliberately initialized to the OPPOSITE of `open` — this forces the
  // very first render to be treated as an "open transition" too, so a
  // dialog that mounts already `open` (as in a direct render in tests, or
  // a future caller that doesn't gate mounting on `open`) still populates
  // its initial values, not just one opened via a later prop change.
  const [wasOpen, setWasOpen] = useState(!open);

  // React's own recommended "adjust state during render" pattern (never an
  // effect) for re-deriving fresh initial values on every open — a plain
  // comparison during render, not a setState-in-effect, so there's no
  // cascading-render or flash-of-stale-values concern. Re-runs exactly once
  // per open transition, never on every render.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setError(null);
      setBusy(false);
      if (initialScheduledAt && initialScheduledTimezone) {
        const split = splitLocalDateTime(initialScheduledAt, initialScheduledTimezone);
        setDate(split.date);
        setTime(split.time);
      } else {
        setDate("");
        setTime("");
      }
    }
  }

  async function handleSubmit() {
    if (!date || !time) {
      setError("Choose a date and time.");
      return;
    }
    const timezone = resolveBrowserTimezone();
    if (!timezone) {
      setError("Couldn't determine your timezone. Try again in a moment.");
      return;
    }
    const instant = toUtcInstant(date, time);
    if (!instant) {
      setError("That date and time isn't valid.");
      return;
    }
    // Re-checked here (not just at initial render) — time may have passed
    // while this dialog was open.
    if (instant.getTime() <= Date.now()) {
      setError("Choose a time in the future.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const result = await onSubmit({ scheduledAt: instant.toISOString(), scheduledTimezone: timezone });
      if (!result.success) {
        setError(result.error ?? "Something went wrong. Please try again.");
        return;
      }
      onClose();
    } catch {
      // An unexpected rejection (network failure, unhandled exception) must
      // never leave the dialog permanently busy — same "no permanent busy
      // state" discipline every other action surface in this app follows.
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-text-muted">Scheduled for the date and time you choose, in your own timezone.</p>

        <div>
          <label htmlFor="social-schedule-date" className="mb-1.5 block text-xs font-medium text-text-muted">
            Date
          </label>
          <Input id="social-schedule-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={busy} invalid={!!error} />
        </div>

        <div>
          <label htmlFor="social-schedule-time" className="mb-1.5 block text-xs font-medium text-text-muted">
            Time
          </label>
          <Input id="social-schedule-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} disabled={busy} invalid={!!error} />
        </div>

        {error ? (
          <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
            {error}
          </p>
        ) : null}

        <div className="mt-1 flex items-center justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={busy} aria-busy={busy}>
            {busy ? "Saving…" : submitLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
