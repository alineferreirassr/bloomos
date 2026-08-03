import { Card } from "@/components/ui/Card";
import type { Contract } from "@/types/contract";
import { formatContractValue } from "@/modules/contracts/mappers";

interface VersionEntry {
  version: number;
  recordedAt: string;
  title: string;
  description: string | null;
  totalValue: number | null;
  depositAmount: number | null;
  isCurrent: boolean;
}

/**
 * Built from Contract.version_history (a snapshot taken immediately before
 * each edit, see types/contract.ts) plus the Contract's own current state as
 * the final, "current" entry — so every version, including the live one,
 * renders through the same list rather than special-casing "now" versus
 * "history." No diff visualization, no separate version-management product
 * — just a changed-fields summary, computed by comparing each entry to the
 * one immediately before it.
 */
function buildVersionEntries(contract: Contract): VersionEntry[] {
  const historical = contract.version_history.map((snapshot) => ({
    version: snapshot.version,
    recordedAt: snapshot.recorded_at,
    title: snapshot.title,
    description: snapshot.description,
    totalValue: snapshot.total_value,
    depositAmount: snapshot.deposit_amount,
    isCurrent: false,
  }));
  const current: VersionEntry = {
    version: contract.version,
    recordedAt: contract.updated_at,
    title: contract.title,
    description: contract.description,
    totalValue: contract.total_value,
    depositAmount: contract.deposit_amount,
    isCurrent: true,
  };
  return [...historical, current];
}

function changedFieldsFrom(previous: VersionEntry | undefined, entry: VersionEntry): string[] {
  if (!previous) return [];
  const changed: string[] = [];
  if (previous.title !== entry.title) changed.push("title");
  if (previous.description !== entry.description) changed.push("description");
  if (previous.totalValue !== entry.totalValue) changed.push("total value");
  if (previous.depositAmount !== entry.depositAmount) changed.push("deposit amount");
  return changed;
}

export function VersionHistorySection({ contract }: { contract: Contract }) {
  const entries = buildVersionEntries(contract);

  return (
    <Card>
      <h3 className="font-serif text-[17px] font-semibold text-text">Version History</h3>
      <ul className="mt-3 space-y-3" data-testid="version-history-list">
        {[...entries].reverse().map((entry, reverseIndex) => {
          const index = entries.length - 1 - reverseIndex;
          const previous = entries[index - 1];
          const changedFields = changedFieldsFrom(previous, entry);
          const action = index === 0 ? "Created" : entry.isCurrent ? "Current" : "Updated";

          return (
            <li key={entry.version} className="border-b border-border pb-3 last:border-0 last:pb-0">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-text">
                  v{entry.version} — {action}
                </span>
                <span className="text-xs text-text-muted">{new Date(entry.recordedAt).toLocaleString()}</span>
              </div>
              <p className="mt-0.5 text-xs text-text-muted">
                {entry.title} · {formatContractValue(entry.totalValue, contract.currency)}
              </p>
              {changedFields.length > 0 ? (
                <p className="mt-0.5 text-xs text-accent">Changed: {changedFields.join(", ")}</p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
