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

export function LeadListTable({ leads }: { leads: Lead[] }) {
  return (
    <div className="hidden overflow-x-auto rounded-2xl border border-border bg-surface md:block">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border text-xs tracking-wide text-text-muted uppercase">
          <tr>
            <th className="px-5 py-4 font-medium">Name</th>
            <th className="px-5 py-4 font-medium">Status</th>
            <th className="px-5 py-4 font-medium">Source</th>
            <th className="px-5 py-4 font-medium">Event type</th>
            <th className="px-5 py-4 font-medium">Event date</th>
            <th className="px-5 py-4 font-medium">Budget</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr
              key={lead.id}
              className="border-b border-border transition-colors duration-150 last:border-0 hover:bg-surface-muted/60"
            >
              <td className="px-5 py-4">
                <Link
                  href={`/leads/${lead.id}`}
                  className="font-medium tracking-tight text-text hover:text-accent"
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
              <td className="px-5 py-4 text-text-muted">
                {formatBudget(lead.budget_min, lead.budget_max)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
