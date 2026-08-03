import Link from "next/link";
import { ContractStatusBadge } from "@/modules/contracts/components/ContractStatusBadge";
import { SignatureStatusBadge } from "@/modules/contracts/components/SignatureStatusBadge";
import { formatContractValue } from "@/modules/contracts/mappers";
import { formatEventDate } from "@/modules/events/dateFormat";
import type { ContractListRow } from "@/modules/contracts/components/ContractsListView";
import { getFullName } from "@/lib/personName";

export function ContractListTable({ rows }: { rows: ContractListRow[] }) {
  return (
    <div className="hidden overflow-x-auto rounded-lg border border-border bg-surface shadow-sm md:block">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="sticky top-0 z-[var(--z-index-dropdown)] bg-surface">
          <tr>
            {[
              "Contract number",
              "Title",
              "Client",
              "Event",
              "Status",
              "Signature status",
              "Version",
              "Effective date",
              "Expiration date",
              "Total value",
              "Deposit",
              "Updated",
              "Next action",
            ].map((heading) => (
              <th
                key={heading}
                className="border-b border-border px-4 py-3 text-[11px] tracking-wide text-text-muted uppercase whitespace-nowrap"
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ contract, client, event, nextAction }) => (
            <tr key={contract.id} className="transition-colors duration-150 hover:bg-accent-100/40">
              <td className="border-b border-border px-2.5 py-2 whitespace-nowrap">
                <Link href={`/contracts/${contract.id}`} className="font-medium text-text hover:text-accent">
                  {contract.contract_number}
                </Link>
              </td>
              <td className="border-b border-border px-2.5 py-2 text-text-muted">{contract.title}</td>
              <td className="border-b border-border px-2.5 py-2 whitespace-nowrap text-text-muted">
                {client ? getFullName(client) : "—"}
              </td>
              <td className="border-b border-border px-2.5 py-2 whitespace-nowrap text-text-muted">
                {event ? event.title : "—"}
              </td>
              <td className="border-b border-border px-2.5 py-2">
                <ContractStatusBadge status={contract.status} />
              </td>
              <td className="border-b border-border px-2.5 py-2">
                <SignatureStatusBadge status={contract.signature_status} />
              </td>
              <td className="border-b border-border px-2.5 py-2 whitespace-nowrap text-text-muted">
                v{contract.version}
              </td>
              <td className="border-b border-border px-2.5 py-2 whitespace-nowrap text-text-muted">
                {formatEventDate(contract.effective_date)}
              </td>
              <td className="border-b border-border px-2.5 py-2 whitespace-nowrap text-text-muted">
                {formatEventDate(contract.expiration_date)}
              </td>
              <td className="border-b border-border px-2.5 py-2 whitespace-nowrap text-text-muted">
                {formatContractValue(contract.total_value, contract.currency)}
              </td>
              <td className="border-b border-border px-2.5 py-2 whitespace-nowrap text-text-muted">
                {contract.deposit_required ? formatContractValue(contract.deposit_amount, contract.currency) : "—"}
              </td>
              <td className="border-b border-border px-2.5 py-2 whitespace-nowrap text-text-muted">
                {new Date(contract.updated_at).toLocaleDateString()}
              </td>
              <td className="border-b border-border px-2.5 py-2 text-text-muted">{nextAction ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
