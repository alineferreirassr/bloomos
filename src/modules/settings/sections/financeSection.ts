import type { SettingDefinition, SettingsSectionDefinition } from "@/types/settings";

export const financeSection: SettingsSectionDefinition = {
  id: "finance",
  label: "Finance",
  description: "Currency, tax rate, invoice numbering, payment terms, late fees, and revenue categories.",
  icon: "Banknote",
  order: 90,
  requiredPermissions: ["workspace.manage"],
  featureFlag: null,
  minimumRole: null,
};

function makeFinanceSetting(
  overrides: Pick<SettingDefinition, "id" | "label" | "description" | "keywords" | "type" | "defaultValue" | "required"> & Partial<Pick<SettingDefinition, "options" | "validate">>,
): SettingDefinition {
  return {
    sectionId: "finance",
    category: null,
    visibility: "visible",
    requiredPermissions: ["workspace.manage"],
    featureFlag: null,
    minimumRole: null,
    version: "v1",
    ...overrides,
  };
}

export const financeCurrencySetting = makeFinanceSetting({
  id: "finance.currency",
  label: "Currency",
  description: "The currency used across Invoices, Proposals, and the Finance Assistant's own figures.",
  keywords: ["currency", "money"],
  type: "select",
  options: [
    { label: "USD ($)", value: "USD" },
    { label: "EUR (€)", value: "EUR" },
    { label: "GBP (£)", value: "GBP" },
  ],
  defaultValue: "USD",
  required: true,
});

export const taxRateSetting = makeFinanceSetting({
  id: "finance.tax-rate",
  label: "Tax Rate (%)",
  description: "The default tax rate applied to a new Invoice line, before an author overrides it.",
  keywords: ["tax", "tax rate"],
  type: "number",
  defaultValue: 0,
  required: true,
  validate: ({ value }) => (typeof value === "number" && (value < 0 || value > 100) ? "Tax rate must be between 0 and 100." : null),
});

export const invoicePrefixSetting = makeFinanceSetting({
  id: "finance.invoice-prefix",
  label: "Invoice Prefix",
  description: "The prefix placed before an Invoice's own sequence number, e.g. \"INV-\".",
  keywords: ["invoice", "prefix", "numbering"],
  type: "string",
  defaultValue: "INV-",
  required: true,
});

export const invoiceNumberingSetting = makeFinanceSetting({
  id: "finance.invoice-numbering",
  label: "Invoice Numbering",
  description: "How the numeric portion of a new Invoice's own number is generated.",
  keywords: ["invoice", "numbering", "sequence"],
  type: "select",
  options: [
    { label: "Sequential", value: "sequential" },
    { label: "Yearly Reset", value: "yearly_reset" },
  ],
  defaultValue: "sequential",
  required: true,
});

export const paymentTermsDaysSetting = makeFinanceSetting({
  id: "finance.payment-terms-days",
  label: "Payment Terms (days)",
  description: "How many days a Client has to pay a new Invoice before it's considered due.",
  keywords: ["payment terms", "due", "net"],
  type: "number",
  defaultValue: 30,
  required: true,
  validate: ({ value }) => (typeof value === "number" && value <= 0 ? "Payment terms must be a positive number of days." : null),
});

export const lateFeePercentSetting = makeFinanceSetting({
  id: "finance.late-fee-percent",
  label: "Late Fee (%)",
  description: "The late fee percentage applied to an Invoice once it's overdue.",
  keywords: ["late fee", "overdue", "penalty"],
  type: "number",
  defaultValue: 0,
  required: false,
  validate: ({ value }) => (typeof value === "number" && (value < 0 || value > 100) ? "Late fee must be between 0 and 100." : null),
});

export const revenueCategoryDefaultSetting = makeFinanceSetting({
  id: "finance.revenue-category-default",
  label: "Default Revenue Category",
  description: "The category a new revenue-generating Invoice line is filed under, unless an author picks another.",
  keywords: ["revenue", "category"],
  type: "select",
  options: [
    { label: "Services", value: "services" },
    { label: "Products", value: "products" },
    { label: "Other", value: "other" },
  ],
  defaultValue: "services",
  required: true,
});

export const financeSettings: SettingDefinition[] = [
  financeCurrencySetting,
  taxRateSetting,
  invoicePrefixSetting,
  invoiceNumberingSetting,
  paymentTermsDaysSetting,
  lateFeePercentSetting,
  revenueCategoryDefaultSetting,
];
