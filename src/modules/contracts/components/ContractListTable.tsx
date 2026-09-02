import Link from "next/link";
import { ContractStatusBadge } from "@/modules/contracts/components/ContractStatusBadge";
import { SignatureStatusBadge } from "@/modules/contracts/components/SignatureStatusBadge";
import { formatContractValue } from "@/modules/contracts/mappers";
import { formatEventDate } from "@/modules/events/dateFormat";
import type { ContractListRow } from "@/modules/contracts/components/ContractsListView";
import { getFullName } from "@/lib/personName";

/* Relationships/CRM visual pass — trimmed from 13 columns to 7 so the list
   reads at a glance ("client, associated work, contract state, important
   date, next action" per the approved brief) instead of decoding a dense
   admin table. Contract number folds under the title as secondary text;
   Signature status sits as a second small badge under Status instead of
   its own column; Version/Deposit/Updated move to the detail page only —
   no field is removed from the data model or the detail view, only from
   this scanning list. Effective→Expiration renders as one compact range. */
export function ContractListTable({ rows }: { rows: ContractListRow[] }) {
  return (
    <div className="hidden overflow-x-auto rounded-2xl bg-surface shadow-luxury-sm md:block">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="sticky top-0 z-[var(--z-index-dropdown)] bg-surface">
          <tr className="border-b border-border/70">
            {["Contract", "Client", "Event", "Status", "Dates", "Value", "Next action"].map((heading) => (
              <th
                key={heading}
                className={`px-5 py-3.5 text-[11px] font-medium tracking-wide text-text-muted uppercase whitespace-nowrap ${heading === "Value" ? "text-right" : ""}`}
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {rows.map(({ contract, client, event, nextAction }) => (
            <tr key={contract.id} className="transition-colors duration-150 hover:bg-accent-100/25">
              <td className="px-5 py-4 whitespace-nowrap">
                <Link href={`/contracts/${contract.id}`} className="text-[15px] font-medium text-text hover:text-accent">
                  {contract.title}
                </Link>
                <p className="mt-0.5 text-xs text-text-muted">{contract.contract_number}</p>
              </td>
              <td className="px-5 py-4 whitespace-nowrap text-text-muted">
                {client ? getFullName(client) : "—"}
              </td>
              <td className="px-5 py-4 whitespace-nowrap text-text-muted">
                {event ? event.title : "—"}
              </td>
              <td className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  <ContractStatusBadge status={contract.status} />
                  <SignatureStatusBadge status={contract.signature_status} />
                </div>
              </td>
              <td className="px-5 py-4 whitespace-nowrap text-text-muted">
                {formatEventDate(contract.effective_date)} → {formatEventDate(contract.expiration_date)}
              </td>
              <td className="px-5 py-4 whitespace-nowrap text-right text-text-muted tabular-nums">
                {formatContractValue(contract.total_value, contract.currency)}
              </td>
              <td className="px-5 py-4 text-text-muted">{nextAction ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
