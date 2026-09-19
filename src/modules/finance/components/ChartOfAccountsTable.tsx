import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { Badge } from "@/components/ui/Badge";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from "@/components/ui/Table";
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
      <div className="hidden md:block">
        <Table>
          <TableHead>
            <tr>
              {["Number", "Name", "Type", "Normal Balance", "Parent Account", "Status"].map((heading) => (
                <TableHeaderCell key={heading} className="whitespace-nowrap">
                  {heading}
                </TableHeaderCell>
              ))}
            </tr>
          </TableHead>
          <TableBody>
            {accounts.map((account) => (
              <TableRow key={account.id}>
                <TableCell className="whitespace-nowrap font-medium text-text">
                  {account.account_number}
                </TableCell>
                <TableCell className="whitespace-nowrap text-text">{account.name}</TableCell>
                <TableCell>
                  <AccountTypeBadge accountType={account.account_type} />
                </TableCell>
                <TableCell className="whitespace-nowrap text-text-muted capitalize">
                  {account.normal_balance}
                </TableCell>
                <TableCell className="whitespace-nowrap text-text-muted">
                  {account.parent_account_id ? (accountsById.get(account.parent_account_id)?.name ?? "—") : "—"}
                </TableCell>
                <TableCell>
                  <Badge tone={account.archived_at ? "neutral" : "accent"}>
                    {account.archived_at ? "Inactive" : "Active"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
