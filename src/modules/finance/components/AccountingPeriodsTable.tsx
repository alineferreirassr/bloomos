import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { AccountingPeriodStatusBadge } from "@/modules/finance/components/AccountingPeriodStatusBadge";
import { formatEventDate } from "@/modules/events/dateFormat";
import type { AccountingPeriod } from "@/types/accountingPeriod";

interface AccountingPeriodsTableProps {
  periods: AccountingPeriod[];
  canUpdate: boolean;
  onClose: (period: AccountingPeriod) => void;
  onLock: (period: AccountingPeriod) => void;
}

/** No direct status editing anywhere here — Close/Lock are the only two transitions offered, each gated to its one valid starting status (open -> closed -> locked), matching close_period/lock_period's own rules exactly. */
export function AccountingPeriodsTable({ periods, canUpdate, onClose, onLock }: AccountingPeriodsTableProps) {
  return (
    <>
      <div className="hidden overflow-x-auto rounded-md border border-border md:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr>
              {["Period", "Status", "Closed", "Locked", "Actions"].map((heading) => (
                <th
                  key={heading}
                  className="border-b border-border px-2.5 py-2 text-[11px] tracking-wide text-text-muted uppercase whitespace-nowrap"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periods.map((period) => (
              <tr key={period.id} className="hover:bg-text/4">
                <td className="border-b border-border px-2.5 py-2 whitespace-nowrap font-medium text-text">
                  {formatEventDate(period.period_start)} – {formatEventDate(period.period_end)}
                </td>
                <td className="border-b border-border px-2.5 py-2">
                  <AccountingPeriodStatusBadge status={period.status} />
                </td>
                <td className="border-b border-border px-2.5 py-2 whitespace-nowrap text-text-muted">
                  {period.closed_at ? `${formatEventDate(period.closed_at)} · ${period.closed_by ?? "—"}` : "—"}
                </td>
                <td className="border-b border-border px-2.5 py-2 whitespace-nowrap text-text-muted">
                  {period.locked_at ? `${formatEventDate(period.locked_at)} · ${period.locked_by ?? "—"}` : "—"}
                </td>
                <td className="border-b border-border px-2.5 py-2 whitespace-nowrap">
                  <div className="flex gap-2">
                    {canUpdate && period.status === "open" ? (
                      <Button variant="secondary" onClick={() => onClose(period)}>
                        Close
                      </Button>
                    ) : null}
                    {canUpdate && period.status === "closed" ? (
                      <Button variant="secondary" onClick={() => onLock(period)}>
                        Lock
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {periods.map((period) => (
          <Card key={period.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium tracking-tight text-text">
                  {formatEventDate(period.period_start)} – {formatEventDate(period.period_end)}
                </p>
                {period.closed_at ? (
                  <p className="mt-0.5 text-xs text-text-muted">Closed {formatEventDate(period.closed_at)}</p>
                ) : null}
                {period.locked_at ? (
                  <p className="mt-0.5 text-xs text-text-muted">Locked {formatEventDate(period.locked_at)}</p>
                ) : null}
              </div>
              <AccountingPeriodStatusBadge status={period.status} />
            </div>
            {canUpdate && (period.status === "open" || period.status === "closed") ? (
              <div className="mt-3 flex gap-2">
                {period.status === "open" ? (
                  <Button variant="secondary" onClick={() => onClose(period)}>
                    Close
                  </Button>
                ) : null}
                {period.status === "closed" ? (
                  <Button variant="secondary" onClick={() => onLock(period)}>
                    Lock
                  </Button>
                ) : null}
              </div>
            ) : null}
          </Card>
        ))}
      </div>
    </>
  );
}
