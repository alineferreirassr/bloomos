import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { Badge } from "@/components/ui/Badge";
import { AccountTypeBadge } from "@/modules/finance/components/AccountTypeBadge";
import type { ChartOfAccount } from "@/types/chartOfAccount";

interface ChartOfAccountsTableProps {
  accounts: ChartOfAccount[];
  accountsById: Map<string, ChartOfAccount>;
}

/** Desktop table + mobile card list in one component (rows are simple enough not to warrant a separate ListCards file) — same hidden md:block / md:hidden split every other Finance list uses. */
export function ChartOfAccountsTable({ accounts, accountsById }: ChartOfAccountsTableProps) {
  return (
    <>
      <div className="hidden overflow-x-auto rounded-2xl bg-surface shadow-luxury-sm md:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border/70">
              {["Number", "Name", "Type", "Normal Balance", "Parent Account", "Status"].map((heading) => (
                <th
                  key={heading}
                  className="px-5 py-4 text-[11px] tracking-wide text-text-muted uppercase whitespace-nowrap"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {accounts.map((account) => (
              <tr key={account.id} className="hover:bg-text/4">
                <td className="px-5 py-4 whitespace-nowrap font-medium text-text">
                  {account.account_number}
                </td>
                <td className="px-5 py-4 whitespace-nowrap text-text">{account.name}</td>
                <td className="px-5 py-4">
                  <AccountTypeBadge accountType={account.account_type} />
                </td>
                <td className="px-5 py-4 whitespace-nowrap text-text-muted capitalize">
                  {account.normal_balance}
                </td>
                <td className="px-5 py-4 whitespace-nowrap text-text-muted">
                  {account.parent_account_id ? (accountsById.get(account.parent_account_id)?.name ?? "—") : "—"}
                </td>
                <td className="px-5 py-4">
                  <Badge tone={account.archived_at ? "neutral" : "accent"}>
                    {account.archived_at ? "Inactive" : "Active"}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {accounts.map((account) => (
          <LuxuryCard key={account.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium tracking-tight text-text">
                  {account.account_number} — {account.name}
                </p>
                <p className="mt-0.5 text-xs text-text-muted capitalize">Normal balance: {account.normal_balance}</p>
                {account.parent_account_id ? (
                  <p className="mt-0.5 text-xs text-text-muted">
                    Parent: {accountsById.get(account.parent_account_id)?.name ?? "—"}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col items-end gap-1">
                <AccountTypeBadge accountType={account.account_type} />
                <Badge tone={account.archived_at ? "neutral" : "accent"}>
                  {account.archived_at ? "Inactive" : "Active"}
                </Badge>
              </div>
            </div>
          </LuxuryCard>
        ))}
      </div>
    </>
  );
}
