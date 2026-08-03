import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { ContractStatusBadge } from "@/modules/contracts/components/ContractStatusBadge";
import { SignatureStatusBadge } from "@/modules/contracts/components/SignatureStatusBadge";
import { formatContractValue } from "@/modules/contracts/mappers";
import { formatEventDate } from "@/modules/events/dateFormat";
import type { ContractListRow } from "@/modules/contracts/components/ContractsListView";
import { getFullName } from "@/lib/personName";

export function ContractListCards({ rows }: { rows: ContractListRow[] }) {
  return (
    <div className="space-y-3 md:hidden">
      {rows.map(({ contract, client, event, nextAction }) => (
        <Link key={contract.id} href={`/contracts/${contract.id}`} className="block">
          <Card className="transition-colors duration-150 hover:border-accent/50">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium tracking-tight text-text">{contract.title}</p>
                <p className="mt-0.5 text-xs text-text-muted">{contract.contract_number}</p>
                <p className="mt-0.5 text-xs text-text-muted">
                  {client ? getFullName(client) : "No client"}
                  {event ? ` · ${event.title}` : ""}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <ContractStatusBadge status={contract.status} />
                <SignatureStatusBadge status={contract.signature_status} />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
              <span className="font-medium text-text">
                {formatContractValue(contract.total_value, contract.currency)}
              </span>
              <span>v{contract.version}</span>
              {contract.effective_date ? <span>{formatEventDate(contract.effective_date)}</span> : null}
            </div>
            {nextAction ? <p className="mt-2 text-xs text-accent">{nextAction}</p> : null}
          </Card>
        </Link>
      ))}
    </div>
  );
}
