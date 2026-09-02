import Link from "next/link";
import type { Lead } from "@/types/lead";
import { LeadStatusBadge } from "@/modules/leads/components/LeadStatusBadge";

function formatBudget(min: number | null, max: number | null): string {
  if (min === null && max === null) return "—";
  const fmt = (n: number) => `$${n.toLocaleString()}`;
  if (min !== null && max !== null) return `${fmt(min)} – ${fmt(max)}`;
  if (min !== null) return `From ${fmt(min)}`;
  return `Up to ${fmt(max as number)}`;
}

/* Relationships/CRM visual pass — premium editorial-data table: quiet
   row dividers instead of a full cell-border grid, comfortable row height,
   a strong primary name with muted secondary metadata, right-aligned
   numeric column. Same columns, same data, same links/actions as before. */
export function LeadListTable({ leads }: { leads: Lead[] }) {
  return (
    <div className="hidden overflow-x-auto rounded-2xl bg-surface shadow-luxury-sm md:block">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="sticky top-0 z-[var(--z-index-dropdown)] bg-surface">
          <tr className="border-b border-border/70">
            <th className="px-5 py-3.5 text-[11px] font-medium tracking-wide text-text-muted uppercase">Name</th>
            <th className="px-5 py-3.5 text-[11px] font-medium tracking-wide text-text-muted uppercase">Status</th>
            <th className="px-5 py-3.5 text-[11px] font-medium tracking-wide text-text-muted uppercase">Source</th>
            <th className="px-5 py-3.5 text-[11px] font-medium tracking-wide text-text-muted uppercase">Event type</th>
            <th className="px-5 py-3.5 text-[11px] font-medium tracking-wide text-text-muted uppercase">Event date</th>
            <th className="px-5 py-3.5 text-right text-[11px] font-medium tracking-wide text-text-muted uppercase">Budget</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {leads.map((lead) => (
            <tr key={lead.id} className="transition-colors duration-150 hover:bg-accent-100/25">
              <td className="px-5 py-4">
                <Link
                  href={`/leads/${lead.id}`}
                  className="text-[15px] font-medium text-text hover:text-accent"
                >
                  {lead.first_name} {lead.last_name}
                </Link>
                <p className="mt-0.5 text-xs text-text-muted">{lead.email}</p>
              </td>
              <td className="px-5 py-4">
                <LeadStatusBadge status={lead.status} />
              </td>
              <td className="px-5 py-4 text-text-muted">{lead.source}</td>
              <td className="px-5 py-4 text-text-muted">{lead.event_type ?? "—"}</td>
              <td className="px-5 py-4 text-text-muted">
                {lead.event_date ? new Date(lead.event_date).toLocaleDateString() : "—"}
              </td>
              <td className="px-5 py-4 text-right text-text-muted tabular-nums">
                {formatBudget(lead.budget_min, lead.budget_max)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
