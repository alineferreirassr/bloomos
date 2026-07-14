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
    <div className="hidden overflow-x-auto rounded-md border border-border md:block">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr>
            <th className="border-b border-border px-2.5 py-2 text-[11px] tracking-wide text-text-muted uppercase">Name</th>
            <th className="border-b border-border px-2.5 py-2 text-[11px] tracking-wide text-text-muted uppercase">Status</th>
            <th className="border-b border-border px-2.5 py-2 text-[11px] tracking-wide text-text-muted uppercase">Source</th>
            <th className="border-b border-border px-2.5 py-2 text-[11px] tracking-wide text-text-muted uppercase">Event type</th>
            <th className="border-b border-border px-2.5 py-2 text-[11px] tracking-wide text-text-muted uppercase">Event date</th>
            <th className="border-b border-border px-2.5 py-2 text-[11px] tracking-wide text-text-muted uppercase">Budget</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id} className="hover:bg-text/4">
              <td className="border-b border-border px-2.5 py-2">
                <Link
                  href={`/leads/${lead.id}`}
                  className="font-medium text-text hover:text-accent"
                >
                  {lead.first_name} {lead.last_name}
                </Link>
                <p className="mt-0.5 text-xs text-text-muted">{lead.email}</p>
              </td>
              <td className="border-b border-border px-2.5 py-2">
                <LeadStatusBadge status={lead.status} />
              </td>
              <td className="border-b border-border px-2.5 py-2 text-text-muted">{lead.source}</td>
              <td className="border-b border-border px-2.5 py-2 text-text-muted">{lead.event_type ?? "—"}</td>
              <td className="border-b border-border px-2.5 py-2 text-text-muted">
                {lead.event_date ? new Date(lead.event_date).toLocaleDateString() : "—"}
              </td>
              <td className="border-b border-border px-2.5 py-2 text-text-muted">
                {formatBudget(lead.budget_min, lead.budget_max)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
