-- Finance Database migration 11 of 11: seed the Chart of Accounts.
--
-- The exact 41-account list designed in the Finance Event Matrix, seeded
-- for every workspace that already exists at migration time (cross-joined
-- against public.workspaces), with on conflict do nothing relying on
-- chart_of_accounts_workspace_account_number_unique (migration 10) for
-- idempotency if this migration is ever re-run.
--
-- This intentionally does NOT seed a Chart of Accounts for a workspace
-- created AFTER this migration runs — doing so would require either a
-- trigger on workspace creation or an onboarding RPC, and this phase is
-- database-schema-only (no RPCs). Backfilling new workspaces with a default
-- Chart of Accounts is a Posting Engine / onboarding-flow concern for a
-- later phase, not solved here.
--
-- Every row is is_system = true — these are the accounts the future
-- Posting Engine's RPCs will reference by number; nothing in this schema
-- yet prevents a workspace from adding its own additional accounts
-- alongside them.

insert into public.chart_of_accounts (workspace_id, account_number, name, account_type, normal_balance, is_system)
select w.id, v.account_number, v.name, v.account_type, v.normal_balance, true
from public.workspaces w
cross join (
  values
    (1000, 'Cash', 'asset', 'debit'),
    (1010, 'Stripe Clearing', 'asset', 'debit'),
    (1100, 'Accounts Receivable', 'asset', 'debit'),
    (1200, 'Inventory Asset', 'asset', 'debit'),
    (1300, 'Prepaid Expenses', 'asset', 'debit'),

    (2000, 'Accounts Payable', 'liability', 'credit'),
    (2100, 'Sales Tax Payable', 'liability', 'credit'),
    (2200, 'Customer Deposits / Unearned Revenue', 'liability', 'credit'),

    (3000, 'Owner''s Equity', 'equity', 'credit'),
    (3900, 'Retained Earnings', 'equity', 'credit'),

    (4000, 'Service Revenue', 'revenue', 'credit'),

    (4900, 'Sales Discounts', 'contra_revenue', 'debit'),
    (4950, 'Refunds & Returns', 'contra_revenue', 'debit'),

    (5000, 'Cost of Goods Sold', 'cost_of_goods_sold', 'debit'),
    (5100, 'Inventory Shrinkage / Write-off', 'cost_of_goods_sold', 'debit'),

    (6100, 'Decor Expense', 'operating_expense', 'debit'),
    (6110, 'Floral Expense', 'operating_expense', 'debit'),
    (6120, 'Rental Expense', 'operating_expense', 'debit'),
    (6130, 'Venue Expense', 'operating_expense', 'debit'),
    (6140, 'Photography Expense', 'operating_expense', 'debit'),
    (6150, 'Videography Expense', 'operating_expense', 'debit'),
    (6160, 'Food & Beverage Expense', 'operating_expense', 'debit'),
    (6170, 'Transportation Expense', 'operating_expense', 'debit'),
    (6180, 'Printing Expense', 'operating_expense', 'debit'),
    (6190, 'Supplies Expense', 'operating_expense', 'debit'),
    (6200, 'Payroll Expense', 'operating_expense', 'debit'),
    (6210, 'Supplier Payments (Non-PO)', 'operating_expense', 'debit'),
    (6220, 'Marketing Expense', 'operating_expense', 'debit'),
    (6230, 'Software & Subscriptions', 'operating_expense', 'debit'),
    (6240, 'Insurance Expense', 'operating_expense', 'debit'),
    (6250, 'Taxes & Licenses', 'operating_expense', 'debit'),
    (6260, 'Bank & Processing Fees', 'operating_expense', 'debit'),
    (6270, 'Travel Expense', 'operating_expense', 'debit'),
    (6280, 'Employee Reimbursements', 'operating_expense', 'debit'),
    (6290, 'Non-Inventory Purchase Items', 'operating_expense', 'debit'),
    (6900, 'Miscellaneous Expense', 'operating_expense', 'debit'),

    (7000, 'Interest Income', 'other_income', 'credit'),
    (7100, 'Inventory Adjustment Gain', 'other_income', 'credit'),
    (7900, 'Other Income', 'other_income', 'credit'),

    (8000, 'Interest Expense', 'other_expense', 'debit'),
    (8900, 'Other Expense', 'other_expense', 'debit')
) as v(account_number, name, account_type, normal_balance)
on conflict (workspace_id, account_number) do nothing;
