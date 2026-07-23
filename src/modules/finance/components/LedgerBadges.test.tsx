import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AccountTypeBadge } from "@/modules/finance/components/AccountTypeBadge";
import { PostingStatusBadge } from "@/modules/finance/components/PostingStatusBadge";
import { AccountingPeriodStatusBadge } from "@/modules/finance/components/AccountingPeriodStatusBadge";
import { ACCOUNT_TYPES, ACCOUNT_TYPE_LABELS } from "@/core/enums/accountType";
import { POSTING_STATUSES, POSTING_STATUS_LABELS } from "@/core/enums/postingStatus";
import { ACCOUNTING_PERIOD_STATUSES, ACCOUNTING_PERIOD_STATUS_LABELS } from "@/core/enums/accountingPeriodStatus";

describe("AccountTypeBadge", () => {
  it.each(ACCOUNT_TYPES)("renders the label for %s", (accountType) => {
    render(<AccountTypeBadge accountType={accountType} />);
    expect(screen.getByText(ACCOUNT_TYPE_LABELS[accountType])).toBeInTheDocument();
  });
});

describe("PostingStatusBadge", () => {
  it.each(POSTING_STATUSES)("renders the label for %s", (status) => {
    render(<PostingStatusBadge status={status} />);
    expect(screen.getByText(POSTING_STATUS_LABELS[status])).toBeInTheDocument();
  });
});

describe("AccountingPeriodStatusBadge", () => {
  it.each(ACCOUNTING_PERIOD_STATUSES)("renders the label for %s", (status) => {
    render(<AccountingPeriodStatusBadge status={status} />);
    expect(screen.getByText(ACCOUNTING_PERIOD_STATUS_LABELS[status])).toBeInTheDocument();
  });
});
