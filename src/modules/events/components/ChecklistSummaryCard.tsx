import Link from "next/link";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { Button } from "@/components/ui/Button";
import { formatEventDate } from "@/modules/events/dateFormat";
import type { ChecklistStats } from "@/modules/events/checklistStats";

/** Read-only summary — full checklist management lives at /events/[id]/checklist (Phase 3). */
export function ChecklistSummaryCard({ eventId, stats }: { eventId: string; stats: ChecklistStats }) {
  return (
    <LuxuryCard>
      <h3 className="font-serif text-[17px] font-semibold text-text">Checklist Summary</h3>
      {stats.total === 0 ? (
        <p className="mt-2 text-sm text-text-muted">No checklist items yet.</p>
      ) : (
        <>
          <dl className="mt-3 grid grid-cols-2 gap-3">
            <Stat label="Total" value={stats.total} />
            <Stat label="Completed" value={stats.completed} />
            <Stat label="Pending" value={stats.pending} />
            <Stat label="Blocked" value={stats.blocked} />
            <Stat label="Overdue" value={stats.overdue} />
            <Stat label="Complete" value={`${stats.percentComplete}%`} />
          </dl>
          <div className="mt-3">
            <p className="text-xs text-text-muted">Next due</p>
            <p className="text-sm text-text">
              {stats.nextDueItem
                ? `${stats.nextDueItem.title}${stats.nextDueItem.due_date ? ` — ${formatEventDate(stats.nextDueItem.due_date)}` : ""}`
                : "—"}
            </p>
          </div>
        </>
      )}
      <Link href={`/events/${eventId}/checklist`}>
        <Button variant="secondary" className="mt-4">
          Manage Checklist
        </Button>
      </Link>
    </LuxuryCard>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="text-sm font-medium text-text">{value}</dd>
    </div>
  );
}
