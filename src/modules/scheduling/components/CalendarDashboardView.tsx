"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { listCalendarsAction, listAppointmentsAction, listReservationsAction, listCalendarWindowsAction, listHolidaysAction, evaluateWorkspaceSchedulingAction, type EvaluateWorkspaceSchedulingResult } from "@/modules/scheduling/schedulingActions";
import type { Calendar, Appointment, Reservation, CalendarWindow, Holiday, SchedulingFindingSeverity } from "@/types/scheduling";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { EventsIcon, CheckIcon, AnalyticsIcon } from "@/components/ui/icons";

/**
 * v2.0 Checkpoint 27, Step 17 — Calendar Dashboard. Every figure is read
 * straight from `evaluateWorkspaceSchedulingAction`'s already-computed
 * result — no worker selection, no dispatch, no AI, same discipline
 * `CapabilityDashboardView.tsx` established.
 *
 * Accessibility (Step 21): real `<button>`/`<a>` elements, `role="list"`/
 * `listitem` for every list, an `aria-live` region for status updates,
 * and severity is always conveyed with a text label alongside the badge
 * color — never color alone.
 *
 * Performance (Step 22): groupings are `useMemo`-derived; evaluation
 * only runs on mount and on an explicit Refresh click, never on every
 * render.
 */
const SEVERITY_TONE: Record<SchedulingFindingSeverity, BadgeTone> = { high: "danger", medium: "warning", low: "neutral" };
const SEVERITY_LABEL: Record<SchedulingFindingSeverity, string> = { high: "High", medium: "Medium", low: "Low" };

function FindingRow({ description, severity }: { description: string; severity: SchedulingFindingSeverity }) {
  return (
    <li role="listitem" className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-b-0">
      <span className="text-sm">{description}</span>
      <Badge tone={SEVERITY_TONE[severity]}>{SEVERITY_LABEL[severity]}</Badge>
    </li>
  );
}

function CalendarRow({ calendar, healthScore, appointmentCount }: { calendar: Calendar; healthScore: number | undefined; appointmentCount: number }) {
  return (
    <li role="listitem" className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-b-0">
      <div className="min-w-0 flex-1">
        <span className="truncate text-sm font-medium">{calendar.name}</span>
        <p className="mt-0.5 text-xs text-text-muted">
          {calendar.context_type.replace(/_/g, " ")} · {appointmentCount} upcoming appointment{appointmentCount === 1 ? "" : "s"}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {healthScore !== undefined ? <span className="text-xs text-text-muted">Health {Math.round(healthScore)}</span> : null}
        <Link href={`/calendar/${calendar.id}`}>
          <Button variant="secondary">View</Button>
        </Link>
      </div>
    </li>
  );
}

function HolidayRow({ holiday }: { holiday: Holiday }) {
  return (
    <li role="listitem" className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-b-0">
      <span className="text-sm">{holiday.name}</span>
      <span className="text-xs text-text-muted">
        {holiday.date}
        {holiday.recurring ? " · recurring" : ""}
        {holiday.emergency ? " · emergency" : ""}
      </span>
    </li>
  );
}

export function CalendarDashboardView() {
  const [calendars, setCalendars] = useState<Calendar[] | null>(null);
  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const [reservations, setReservations] = useState<Reservation[] | null>(null);
  const [windows, setWindows] = useState<CalendarWindow[] | null>(null);
  const [holidays, setHolidays] = useState<Holiday[] | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluateWorkspaceSchedulingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([listCalendarsAction(), listAppointmentsAction(), listReservationsAction(), listCalendarWindowsAction(), listHolidaysAction(), evaluateWorkspaceSchedulingAction()]).then(([calResult, apptResult, resResult, windowResult, holidayResult, evalResult]) => {
      if (cancelled) return;
      if (calResult.success) setCalendars(calResult.data);
      if (apptResult.success) setAppointments(apptResult.data);
      if (resResult.success) setReservations(resResult.data);
      if (windowResult.success) setWindows(windowResult.data);
      if (holidayResult.success) setHolidays(holidayResult.data);
      if (evalResult.success) setEvaluation(evalResult.data);

      if (!calResult.success) setError(calResult.error);
      else if (!apptResult.success) setError(apptResult.error);
      else if (!resResult.success) setError(resResult.error);
      else if (!windowResult.success) setError(windowResult.error);
      else if (!holidayResult.success) setError(holidayResult.error);
      else if (!evalResult.success) setError(evalResult.error);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function refresh() {
    setLoading(true);
    const [calResult, apptResult, resResult, windowResult, holidayResult, evalResult] = await Promise.all([listCalendarsAction(), listAppointmentsAction(), listReservationsAction(), listCalendarWindowsAction(), listHolidaysAction(), evaluateWorkspaceSchedulingAction()]);
    if (calResult.success) setCalendars(calResult.data);
    if (apptResult.success) setAppointments(apptResult.data);
    if (resResult.success) setReservations(resResult.data);
    if (windowResult.success) setWindows(windowResult.data);
    if (holidayResult.success) setHolidays(holidayResult.data);
    if (evalResult.success) setEvaluation(evalResult.data);

    if (!calResult.success) setError(calResult.error);
    else if (!apptResult.success) setError(apptResult.error);
    else if (!resResult.success) setError(resResult.error);
    else if (!windowResult.success) setError(windowResult.error);
    else if (!holidayResult.success) setError(holidayResult.error);
    else if (!evalResult.success) setError(evalResult.error);
    else setError(null);

    setAnnouncement("Schedule refreshed.");
    setLoading(false);
  }

  const now = useMemo(() => new Date().toISOString(), []);
  const todayEnd = useMemo(() => new Date(new Date(now).getTime() + 24 * 60 * 60_000).toISOString(), [now]);

  const todaysAppointments = useMemo(() => (appointments ?? []).filter((a) => a.status !== "cancelled" && a.starts_at >= now && a.starts_at <= todayEnd).sort((a, b) => a.starts_at.localeCompare(b.starts_at)), [appointments, now, todayEnd]);

  const upcomingReservations = useMemo(() => (reservations ?? []).filter((r) => r.status === "held" || r.status === "confirmed").sort((a, b) => a.starts_at.localeCompare(b.starts_at)).slice(0, 10), [reservations]);

  const blockedWindows = useMemo(() => (windows ?? []).filter((w) => w.type !== "available" && w.ends_at >= now).sort((a, b) => a.starts_at.localeCompare(b.starts_at)).slice(0, 10), [windows, now]);

  const upcomingHolidays = useMemo(() => (holidays ?? []).slice().sort((a, b) => a.date.localeCompare(b.date)).slice(0, 10), [holidays]);

  const appointmentCountByCalendarId = useMemo(() => {
    const counts = new Map<string, number>();
    for (const appointment of appointments ?? []) {
      if (appointment.status === "cancelled") continue;
      counts.set(appointment.calendar_id, (counts.get(appointment.calendar_id) ?? 0) + 1);
    }
    return counts;
  }, [appointments]);

  const highFindings = useMemo(() => evaluation?.findings.filter((f) => f.severity === "high") ?? [], [evaluation]);
  const otherFindings = useMemo(() => evaluation?.findings.filter((f) => f.severity !== "high") ?? [], [evaluation]);

  const averageHealth = useMemo(() => {
    const scores = Object.values(evaluation?.scoresByCalendarId ?? {});
    if (scores.length === 0) return null;
    return scores.reduce((sum, s) => sum + s.calendarHealthScore, 0) / scores.length;
  }, [evaluation]);

  return (
    <div>
      <PageHeader
        title="Calendar & Scheduling"
        subtitle="When work can happen — availability windows, reservations, buffers, capacity, and scheduling conflicts. Scheduling never selects or assigns a worker."
        icon={EventsIcon}
        breadcrumb={[{ label: "Calendar" }]}
        actions={
          <Button variant="secondary" onClick={refresh} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
        }
      />

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {error ? <EmptyState title="Scheduling isn't available" description={error} icon={EventsIcon} /> : null}

      {calendars ? (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard label="Calendars" value={String(calendars.length)} icon={EventsIcon} />
            <KpiCard label="Today's Appointments" value={String(todaysAppointments.length)} icon={EventsIcon} />
            <KpiCard label="Findings" value={String(evaluation?.findings.length ?? 0)} icon={AnalyticsIcon} />
            <KpiCard label="Average Calendar Health" value={averageHealth === null ? "—" : String(Math.round(averageHealth))} icon={CheckIcon} />
          </div>

          <Card className="mb-6">
            <h2 className="mb-3 text-sm font-semibold">
              High-Severity Findings <span className="font-normal text-text-muted">({highFindings.length})</span>
            </h2>
            {highFindings.length === 0 ? <p className="text-sm text-success">No high-severity scheduling findings.</p> : <ul role="list">{highFindings.map((f) => <FindingRow key={f.id} description={f.description} severity={f.severity} />)}</ul>}
          </Card>

          <Card className="mb-6">
            <h2 className="mb-3 text-sm font-semibold">
              Other Findings <span className="font-normal text-text-muted">({otherFindings.length})</span>
            </h2>
            {otherFindings.length === 0 ? <p className="text-sm text-text-muted">Nothing else to report.</p> : <ul role="list">{otherFindings.slice(0, 10).map((f) => <FindingRow key={f.id} description={f.description} severity={f.severity} />)}</ul>}
          </Card>

          <Card className="mb-6">
            <h2 className="mb-3 text-sm font-semibold">
              Calendars <span className="font-normal text-text-muted">({calendars.length})</span>
            </h2>
            {calendars.length === 0 ? (
              <EmptyState title="No calendars yet" description="Calendars are created through the Calendar Registry." icon={EventsIcon} />
            ) : (
              <ul role="list">
                {calendars.map((c) => (
                  <CalendarRow key={c.id} calendar={c} healthScore={evaluation?.scoresByCalendarId[c.id]?.calendarHealthScore} appointmentCount={appointmentCountByCalendarId.get(c.id) ?? 0} />
                ))}
              </ul>
            )}
          </Card>

          <div className="mb-6 grid gap-6 md:grid-cols-2">
            <Card>
              <h2 className="mb-3 text-sm font-semibold">
                Upcoming Reservations <span className="font-normal text-text-muted">({upcomingReservations.length})</span>
              </h2>
              {upcomingReservations.length === 0 ? (
                <p className="text-sm text-text-muted">No held or confirmed reservations.</p>
              ) : (
                <ul role="list">
                  {upcomingReservations.map((r) => (
                    <li key={r.id} role="listitem" className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-b-0">
                      <span className="text-sm">
                        {r.resource_type} · {r.resource_id}
                      </span>
                      <Badge tone={r.status === "confirmed" ? "success" : "warning"}>{r.status === "confirmed" ? "Confirmed" : "Held"}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <h2 className="mb-3 text-sm font-semibold">
                Blocked Periods <span className="font-normal text-text-muted">({blockedWindows.length})</span>
              </h2>
              {blockedWindows.length === 0 ? (
                <p className="text-sm text-text-muted">No upcoming blocked periods.</p>
              ) : (
                <ul role="list">
                  {blockedWindows.map((w) => (
                    <li key={w.id} role="listitem" className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-b-0">
                      <span className="text-sm">{w.reason ?? w.type.replace(/_/g, " ")}</span>
                      <Badge tone="neutral">{w.type.replace(/_/g, " ")}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card>
            <h2 className="mb-3 text-sm font-semibold">
              Holiday Calendar <span className="font-normal text-text-muted">({upcomingHolidays.length})</span>
            </h2>
            {upcomingHolidays.length === 0 ? <p className="text-sm text-text-muted">No holidays configured.</p> : <ul role="list">{upcomingHolidays.map((h) => <HolidayRow key={h.id} holiday={h} />)}</ul>}
          </Card>
        </>
      ) : !error ? (
        <p className="text-sm text-text-muted">Loading the schedule…</p>
      ) : null}
    </div>
  );
}
