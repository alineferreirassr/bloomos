import Link from "next/link";
import { ContractStatusBadge } from "@/modules/contracts/components/ContractStatusBadge";
import { SignatureStatusBadge } from "@/modules/contracts/components/SignatureStatusBadge";
import { formatContractValue } from "@/modules/contracts/mappers";
import { formatEventDate } from "@/modules/events/dateFormat";
import type { ContractListRow } from "@/modules/contracts/components/ContractsListView";
import { getFullName } from "@/lib/personName";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from "@/components/ui/Table";

// GLOBAL-VISUAL-04R — deep control migration: rebuilt on the shared
// Table primitive (see LeadListTable.tsx for the full rationale). Column
// set (Contract/Client/Event/Status/Dates/Value/Next action) and all
// data/links unchanged from the prior "Relationships/CRM visual pass" trim.
export function ContractListTable({ rows }: { rows: ContractListRow[] }) {
  return (
    <div className="hidden md:block">
      <Table>
        <TableHead>
          <tr>
            {["Contract", "Client", "Event", "Status", "Dates", "Value", "Next action"].map((heading) => (
              <TableHeaderCell key={heading} className={`whitespace-nowrap ${heading === "Value" ? "text-right" : ""}`}>
                {heading}
              </TableHeaderCell>
            ))}
          </tr>
        </TableHead>
        <TableBody>
          {rows.map(({ contract, client, event, nextAction }) => (
            <TableRow key={contract.id}>
              <TableCell className="whitespace-nowrap">
                <Link href={`/contracts/${contract.id}`} className="text-[15px] font-medium text-text hover:text-accent">
                  {contract.title}
                </Link>
                <p className="mt-0.5 text-xs text-text-muted">{contract.contract_number}</p>
              </TableCell>
              <TableCell className="whitespace-nowrap text-text-muted">
                {client ? getFullName(client) : "—"}
              </TableCell>
              <TableCell className="whitespace-nowrap text-text-muted">
                {event ? event.title : "—"}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap items-center gap-1.5">
                  <ContractStatusBadge status={contract.status} />
                  <SignatureStatusBadge status={contract.signature_status} />
                </div>
              </TableCell>
              <TableCell className="whitespace-nowrap text-text-muted">
                {formatEventDate(contract.effective_date)} → {formatEventDate(contract.expiration_date)}
              </TableCell>
              <TableCell className="whitespace-nowrap text-right text-text-muted tabular-nums">
                {formatContractValue(contract.total_value, contract.currency)}
              </TableCell>
              <TableCell className="text-text-muted">{nextAction ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
