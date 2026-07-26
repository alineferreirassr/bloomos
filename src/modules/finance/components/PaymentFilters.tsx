"use client";

import { Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { Select } from "@/components/ui/Select";
import { PAYMENT_TYPE_LABELS, PAYMENT_TYPES, type PaymentType } from "@/core/enums/paymentType";
import { PAYMENT_STATUS_LABELS, PAYMENT_STATUSES, type PaymentStatus } from "@/core/enums/paymentStatus";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS, type PaymentMethod } from "@/core/enums/paymentMethod";

export interface PaymentFiltersValue {
  search: string;
  status: PaymentStatus | "all";
  paymentType: PaymentType | "all";
  paymentMethod: PaymentMethod | "all";
  dateFrom: string;
  dateTo: string;
  refundsOnly: boolean;
}

export const DEFAULT_PAYMENT_FILTERS: PaymentFiltersValue = {
  search: "",
  status: "all",
  paymentType: "all",
  paymentMethod: "all",
  dateFrom: "",
  dateTo: "",
  refundsOnly: false,
};

interface PaymentFiltersProps {
  value: PaymentFiltersValue;
  onChange: (value: PaymentFiltersValue) => void;
}

export function PaymentFilters({ value, onChange }: PaymentFiltersProps) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          placeholder="Search client, event, reference…"
          value={value.search}
          onChange={(event) => onChange({ ...value, search: event.target.value })}
          aria-label="Search payments"
          className="lg:col-span-2"
        />
        <Select
          aria-label="Filter by type"
          value={value.paymentType}
          onChange={(event) => onChange({ ...value, paymentType: event.target.value as PaymentType | "all" })}
        >
          <option value="all">All types</option>
          {PAYMENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {PAYMENT_TYPE_LABELS[type]}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filter by status"
          value={value.status}
          onChange={(event) => onChange({ ...value, status: event.target.value as PaymentStatus | "all" })}
        >
          <option value="all">All statuses</option>
          {PAYMENT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {PAYMENT_STATUS_LABELS[status]}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select
          aria-label="Filter by payment method"
          value={value.paymentMethod}
          onChange={(event) => onChange({ ...value, paymentMethod: event.target.value as PaymentMethod | "all" })}
        >
          <option value="all">All methods</option>
          {PAYMENT_METHODS.map((method) => (
            <option key={method} value={method}>
              {PAYMENT_METHOD_LABELS[method]}
            </option>
          ))}
        </Select>
        <Input
          type="date"
          aria-label="Date from"
          value={value.dateFrom}
          onChange={(event) => onChange({ ...value, dateFrom: event.target.value })}
        />
        <Input
          type="date"
          aria-label="Date to"
          value={value.dateTo}
          onChange={(event) => onChange({ ...value, dateTo: event.target.value })}
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-text-muted">
        <Checkbox
          checked={value.refundsOnly}
          onChange={(event) => onChange({ ...value, refundsOnly: event.target.checked })}
        />
        Refunds only
      </label>
    </div>
  );
}
