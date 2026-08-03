import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ContractStatusBadge } from "@/modules/contracts/components/ContractStatusBadge";
import type { Contract } from "@/types/contract";

interface EventContractsSummaryCardProps {
  contracts: Contract[];
}

/**
 * Read-only rollup on Event Detail — `getContracts({ eventId })` already
 * supports this filter (`ContractFilters.eventId`), so this reuses the
 * existing query as-is rather than adding a new one. Closes the Event ↔
 * Contract link that previously only existed in the other direction
 * (Contract Detail already links back to its Event). No "New Contract"
 * prefill link — `NewContractView`/`ContractForm` don't read an `eventId`
 * query param today (the form's Event dropdown only populates once a
 * Client is chosen, same one-step-at-a-time flow Invoice creation uses),
 * so a "create" link here would silently do nothing extra; "Manage
 * Checklist"-style, the plain `/contracts/new` link is honest about that.
 */
export function EventContractsSummaryCard({ contracts }: EventContractsSummaryCardProps) {
  return (
    <Card>
      <h3 className="font-serif text-[17px] font-semibold text-text">Contracts</h3>
      {contracts.length === 0 ? (
        <p className="mt-2 text-sm text-text-muted">No contracts linked to this event.</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {contracts.map((contract) => (
            <li key={contract.id} className="flex items-center justify-between gap-3 border-b border-border/60 pb-2 last:border-0 last:pb-0">
              <Link href={`/contracts/${contract.id}`} className="min-w-0 truncate text-text hover:text-accent hover:underline">
                {contract.title}
              </Link>
              <ContractStatusBadge status={contract.status} />
            </li>
          ))}
        </ul>
      )}
      <Link href="/contracts/new">
        <Button variant="secondary" className="mt-4">
          New Contract
        </Button>
      </Link>
    </Card>
  );
}
