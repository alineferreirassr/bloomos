import Link from "next/link";
import type { Lead } from "@/types/lead";
import { LeadStatusBadge } from "@/modules/leads/components/LeadStatusBadge";
import { getLeadDisplayName } from "@/lib/personName";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from "@/components/ui/Table";

function formatBudget(min: number | null, max: number | null): string {
  if (min === null && max === null) return "—";
  const fmt = (n: number) => `$${n.toLocaleString()}`;
  if (min !== null && max !== null) return `${fmt(min)} – ${fmt(max)}`;
  if (min !== null) return `From ${fmt(min)}`;
  return `Up to ${fmt(max as number)}`;
}

// GLOBAL-VISUAL-04R — deep control migration: this table previously
// hand-rolled its own <table> markup (a bespoke "premium editorial" pass
// with a rounded-2xl/shadow-luxury-sm wrapper and a sticky header AF's own
// table has neither of). Rebuilt on the shared Table/TableHead/TableRow/
// TableHeaderCell/TableCell primitive (src/components/ui/Table.tsx),
// itself already ported to AF's real table.tsx geometry — one shared
// primitive, so this table and every other CRM table now render
// identically instead of three divergent hand-built implementations. Same
// columns, same data, same links/actions as before.
export function LeadListTable({ leads }: { leads: Lead[] }) {
  return (
    <div className="hidden md:block">
      <Table>
        <TableHead>
          <tr>
            <TableHeaderCell>Name</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell>Source</TableHeaderCell>
            <TableHeaderCell>Event type</TableHeaderCell>
            <TableHeaderCell>Event date</TableHeaderCell>
            <TableHeaderCell className="text-right">Budget</TableHeaderCell>
          </tr>
        </TableHead>
        <TableBody>
          {leads.map((lead) => (
            <TableRow key={lead.id}>
              <TableCell>
                <Link
                  href={`/leads/${lead.id}`}
                  className="text-[15px] font-medium text-text hover:text-accent"
                >
                  {getLeadDisplayName(lead)}
                </Link>
                <p className="mt-0.5 text-xs text-text-muted">{lead.email}</p>
              </TableCell>
              <TableCell>
                <LeadStatusBadge status={lead.status} />
              </TableCell>
              <TableCell className="text-text-muted">{lead.source}</TableCell>
              <TableCell className="text-text-muted">{lead.event_type ?? "—"}</TableCell>
              <TableCell className="text-text-muted">
                {lead.event_date ? new Date(lead.event_date).toLocaleDateString() : "—"}
              </TableCell>
              <TableCell className="text-right text-text-muted tabular-nums">
                {formatBudget(lead.budget_min, lead.budget_max)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
