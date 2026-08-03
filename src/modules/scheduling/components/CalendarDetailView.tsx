"use client";

import { useEffect, useMemo, useState } from "react";
import { getCalendarAction, getCalendarViewAction, listReservationsAction, listWorkingHoursRulesAction, listCalendarWindowsAction, evaluateWorkspaceSchedulingAction, type EvaluateWorkspaceSchedulingResult } from "@/modules/scheduling/schedulingActions";
import { detectAppointmentConflicts } from "@/core/scheduling/conflictEngine";
import type { Calendar, CalendarView, Reservation, WorkingHoursRule, CalendarWindow, SchedulingConflict } from "@/types/scheduling";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { EventsIcon, AnalyticsIcon, CheckIcon } from "@/components/ui/icons";

/**
 * v2.0 Checkpoint 27, Step 18 — Calendar Detail View. One calendar's full
 * picture: upcoming appointments (including recurring instances, via
 * `getCalendarViewAction`), reservations, working hours, blocked
 * windows, conflicts, and its own `SchedulingScores`. Read-only — no
 * worker selection, no dispatch action of any kind lives here.
 */
const DETAIL_LOOKAHEAD_DAYS = 14;
const CONFLICT_SEVERITY_TONE: Record<SchedulingConflict["severity"], BadgeTone> = { high: "danger", medium: "warning", low: "neutral" };
const WORKING_HOURS_DAY_LABEL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function CalendarDetailView({ calendarId }: { calendarId: string }) {
  const [calendar, setCalendar] = useState<Calendar | null>(null);
  const [view, setView] = useState<CalendarView | null>(null);
  const [reservations, setReservations] = useState<Reservation[] | null>(null);
  const [workingHours, setWorkingHours] = useState<WorkingHoursRule[] | null>(null);
  const [windows, setWindows] = useState<CalendarWindow[] | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluateWorkspaceSchedulingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const rangeStart = new Date().toISOString();
    const rangeEnd = new Date(Date.now() + DETAIL_LOOKAHEAD_DAYS * 24 * 60 * 60_000).toISOString();

    getCalendarAction(calendarId).then(async (calResult) => {
      if (cancelled) return;
      if (!calResult.success) {
        setError(calResult.error);
        return;
      }
      setCalendar(calResult.data);

      const [viewResult, resResult, whResult, windowResult, evalResult] = await Promise.all([getCalendarViewAction(calendarId, "weekly", rangeStart, rangeEnd), listReservationsAction(calendarId), listWorkingHoursRulesAction(calendarId), listCalendarWindowsAction(calendarId), evaluateWorkspaceSchedulingAction()]);
      if (cancelled) return;

      if (viewResult.success) setView(viewResult.data);
      if (resResult.success) setReservations(resResult.data);
      if (whResult.success) setWorkingHours(whResult.data);
      if (windowResult.success) setWindows(windowResult.data);
      if (evalResult.success) setEvaluation(evalResult.data);

      if (!viewResult.success) setError(viewResult.error);
      else if (!resResult.success) setError(resResult.error);
      else if (!whResult.success) setError(whResult.error);
      else if (!windowResult.success) setError(windowResult.error);
      else if (!evalResult.success) setError(evalResult.error);
    });

    return () => {
      cancelled = true;
    };
  }, [calendarId]);

  const conflictsByAppointmentId = useMemo(() => {
    if (!view) return new Map<string, SchedulingConflict[]>();
    const others = view.entries.map((e) => e.appointment);
    const map = new Map<string, SchedulingConflict[]>();
    for (const entry of view.entries) {
      const appointment = entry.appointment;
      const conflicts = detectAppointmentConflicts({
        candidate: { id: appointment.id, calendar_id: appointment.calendar_id, workspace_id: appointment.workspace_id, starts_at: appointment.starts_at, ends_at: appointment.ends_at, worker_id: appointment.worker_id, preparation_minutes: appointment.preparation_minutes, cleanup_minutes: appointment.cleanup_minutes },
        timeZone: calendar?.time_zone ?? "UTC",
        otherAppointments: others,
        calendarWindows: windows ?? [],
        holidays: [],
      });
      if (conflicts.length > 0) map.set(`${appointment.id}:${appointment.starts_at}`, conflicts);
    }
    return map;
  }, [view, windows, calendar]);

  const totalConflictCount = useMemo(() => Array.from(conflictsByAppointmentId.values()).reduce((sum, c) => sum + c.length, 0), [conflictsByAppointmentId]);

  const scores = evaluation?.scoresByCalendarId[calendarId] ?? null;
  const relatedFindings = useMemo(() => evaluation?.findings.filter((f) => f.relatedCalendarId === calendarId) ?? [], [evaluation, calendarId]);

  const sortedWorkingHours = useMemo(() => (workingHours ?? []).slice().sort((a, b) => (a.day_of_week ?? 7) - (b.day_of_week ?? 7)), [workingHours]);
  const blockedWindows = useMemo(() => (windows ?? []).filter((w) => w.type !== "available"), [windows]);

  if (error) return <EmptyState title="This calendar isn't available" description={error} icon={EventsIcon} />;
  if (!calendar) return <p className="text-sm text-text-muted">Loading calendar…</p>;

  return (
    <div>
      <PageHeader title={calendar.name} subtitle={calendar.description ?? `${calendar.context_type.replace(/_/g, " ")} calendar in ${calendar.time_zone}.`} icon={EventsIcon} breadcrumb={[{ label: "Calendar", href: "/calendar" }, { label: calendar.name }]} />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Upcoming Appointments" value={String(view?.entries.length ?? 0)} icon={EventsIcon} />
        <KpiCard label="Reservations" value={String(reservations?.length ?? 0)} icon={EventsIcon} />
        <KpiCard label="Conflicts" value={String(totalConflictCount)} icon={AnalyticsIcon} />
        <KpiCard label="Calendar Health" value={scores === null ? "—" : String(Math.round(scores.calendarHealthScore))} icon={CheckIcon} />
      </div>

      {scores ? (
        <Card className="mb-6">
          <h2 className="mb-3 text-sm font-semibold">Schedule Quality</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <ScoreItem label="Window Quality" value={scores.windowQualityScore} />
            <ScoreItem label="Buffer Quality" value={scores.bufferQualityScore} />
            <ScoreItem label="Capacity Utilization" value={scores.capacityUtilizationScore} />
            <ScoreItem label="Conflict Severity" value={scores.conflictSeverityScore} />
            <ScoreItem label="Schedule Density" value={scores.scheduleDensityScore} />
            <ScoreItem label="Calendar Health" value={scores.calendarHealthScore} />
          </div>
        </Card>
      ) : null}

      {relatedFindings.length > 0 ? (
        <Card className="mb-6">
          <h2 className="mb-3 text-sm font-semibold">
            Findings <span className="font-normal text-text-muted">({relatedFindings.length})</span>
          </h2>
          <ul role="list">
            {relatedFindings.map((f) => (
              <li key={f.id} role="listitem" className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-b-0">
                <span className="text-sm">{f.description}</span>
                <Badge tone={f.severity === "high" ? "danger" : f.severity === "medium" ? "warning" : "neutral"}>{f.severity}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-semibold">
          Appointments <span className="font-normal text-text-muted">(next {DETAIL_LOOKAHEAD_DAYS} days)</span>
        </h2>
        {!view || view.entries.length === 0 ? (
          <EmptyState title="No upcoming appointments" description="Appointments are created through the Appointment Model." icon={EventsIcon} />
        ) : (
          <ul role="list">
            {view.entries.map((entry) => {
              const key = `${entry.appointment.id}:${entry.appointment.starts_at}`;
              const conflicts = conflictsByAppointmentId.get(key) ?? [];
              return (
                <li key={key} role="listitem" className="border-b border-border/50 py-2 last:border-b-0">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <span className="truncate text-sm font-medium">{entry.appointment.title}</span>
                      <p className="mt-0.5 text-xs text-text-muted">
                        {new Date(entry.appointment.starts_at).toLocaleString()} – {new Date(entry.appointment.ends_at).toLocaleTimeString()}
                        {entry.isRecurringInstance ? " · recurring" : ""}
                      </p>
                    </div>
                    <Badge tone={entry.appointment.status === "confirmed" ? "success" : entry.appointment.status === "tentative" ? "warning" : "neutral"}>{entry.appointment.status}</Badge>
                  </div>
                  {conflicts.length > 0 ? (
                    <ul role="list" className="mt-1 pl-2">
                      {conflicts.map((c) => (
                        <li key={c.id} role="listitem" className="flex items-center gap-2 text-xs">
                          <Badge tone={CONFLICT_SEVERITY_TONE[c.severity]}>{c.type.replace(/_/g, " ")}</Badge>
                          <span className="text-text-muted">{c.description}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <div className="mb-6 grid gap-6 md:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-semibold">
            Reservations <span className="font-normal text-text-muted">({reservations?.length ?? 0})</span>
          </h2>
          {!reservations || reservations.length === 0 ? (
            <p className="text-sm text-text-muted">No reservations for this calendar.</p>
          ) : (
            <ul role="list">
              {reservations.map((r) => (
                <li key={r.id} role="listitem" className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-b-0">
                  <span className="text-sm">
                    {r.resource_type} · {r.resource_id}
                  </span>
                  <Badge tone={r.status === "confirmed" ? "success" : r.status === "held" ? "warning" : "neutral"}>{r.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold">
            Working Hours <span className="font-normal text-text-muted">({sortedWorkingHours.length})</span>
          </h2>
          {sortedWorkingHours.length === 0 ? (
            <p className="text-sm text-text-muted">No working hours configured.</p>
          ) : (
            <ul role="list">
              {sortedWorkingHours.map((rule) => (
                <li key={rule.id} role="listitem" className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-b-0">
                  <span className="text-sm">{rule.specific_date ?? (rule.day_of_week !== null ? WORKING_HOURS_DAY_LABEL[rule.day_of_week] : rule.kind)}</span>
                  <span className="text-xs text-text-muted">{rule.is_closed ? "Closed" : `${rule.starts_time}–${rule.ends_time}`}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <h2 className="mb-3 text-sm font-semibold">
          Blocked Periods <span className="font-normal text-text-muted">({blockedWindows.length})</span>
        </h2>
        {blockedWindows.length === 0 ? (
          <p className="text-sm text-text-muted">No blocked periods for this calendar.</p>
        ) : (
          <ul role="list">
            {blockedWindows.map((w) => (
              <li key={w.id} role="listitem" className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-b-0">
                <span className="text-sm">{w.reason ?? w.type.replace(/_/g, " ")}</span>
                <span className="text-xs text-text-muted">
                  {new Date(w.starts_at).toLocaleString()} – {new Date(w.ends_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function ScoreItem({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs text-text-muted">{label}</p>
      <p className="text-lg font-semibold">{Math.round(value)}</p>
    </div>
  );
}
