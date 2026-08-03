-- Finance Posting Engine migration 2 of 9: post_purchase_receipt +
-- composition into the existing record_purchase_receipt.
--
-- source_id is purchase_item_id — the operational document a Purchase
-- Receipt's Journal Entry must stay traceable to. posting_key is a
-- separate identity: purchase_item_id is deliberately NOT unique per
-- receipt event (one item legitimately receives several partial-receipt
-- postings), so idempotency can't ride on source_id here the way it does
-- for every other posting RPC in this set. posting_key omits
-- workspace_id — the (workspace_id, posting_key) unique index from
-- 20260804095000_finance_posting_key.sql already scopes uniqueness per
-- workspace, so repeating it inside the string would be redundant.
--
-- IDEMPOTENT REPLAY, not duplicate rejection: unlike every other posting
-- RPC in this migration set (which raises P1104 on a repeat), a repeat
-- p_receipt_event_id here represents a REPLAY of an already-completed
-- operation, not an error — the caller gets the same success back, with
-- no further mutation. That's why record_purchase_receipt checks for it
-- FIRST, before any mutation (over-receipt validation, the Inventory
-- movement, the quantity_received update, the Timeline insert), and
-- returns the current row rather than raising. post_purchase_receipt's own
-- check further below still raises P1104 — that's only a standalone-
-- invocation backstop; record_purchase_receipt's own check is what
-- actually guards the real call path against a double mutation.
--
-- Concurrency: the purchase_items `for update` lock already taken for
-- domain validation also serializes the idempotency check, so no
-- additional lock is needed — two concurrent calls for the same item
-- (same or different event id) resolve one after the other, and the
-- second always observes whatever the first actually committed. The
-- (workspace_id, posting_key) unique index remains the final,
-- unconditional database-level backstop.

create or replace function public.post_purchase_receipt(
  p_purchase_item_id uuid,
  p_quantity_received integer,
  p_receipt_event_id uuid,
  p_actor text
)
returns public.journal_entries
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_item public.purchase_items;
  v_purchase public.purchases;
  v_debit_account public.chart_of_accounts;
  v_credit_account public.chart_of_accounts;
  v_amount_minor integer;
  v_posting_key text;
  v_entry public.journal_entries;
begin
  select * into v_item from public.purchase_items where id = p_purchase_item_id;
  if not found then
    raise exception 'Purchase item not found.' using errcode = 'P1111';
  end if;

  select * into v_purchase from public.purchases where id = v_item.purchase_id;
  if not found then
    raise exception 'Purchase not found.' using errcode = 'P1111';
  end if;

  v_posting_key := 'purchase_receipt:' || p_receipt_event_id;

  if exists (select 1 from public.journal_entries where workspace_id = v_purchase.workspace_id and posting_key = v_posting_key) then
    raise exception 'This receipt event has already been posted.' using errcode = 'P1104';
  end if;

  v_amount_minor := v_item.unit_cost_minor * p_quantity_received;

  v_credit_account := public.finance_resolve_account(v_purchase.workspace_id, 2000);

  if v_item.inventory_item_id is not null then
    v_debit_account := public.finance_resolve_account(v_purchase.workspace_id, 1200);
  else
    v_debit_account := public.finance_resolve_account(v_purchase.workspace_id, 6290);
  end if;

  v_entry := public.finance_insert_journal_entry(
    v_purchase.workspace_id,
    (now() at time zone 'utc')::date,
    'purchase_receipt',
    p_purchase_item_id::text,
    'Receipt of ' || p_quantity_received || ' × "' || v_item.name || '" against ' || v_purchase.purchase_number,
    p_actor,
    null,
    v_posting_key,
    jsonb_build_array(
      jsonb_build_object('account_id', v_debit_account.id, 'debit_minor', v_amount_minor, 'credit_minor', 0),
      jsonb_build_object('account_id', v_credit_account.id, 'debit_minor', 0, 'credit_minor', v_amount_minor)
    )
  );

  return v_entry;
end;
$$;

comment on function public.post_purchase_receipt(uuid, integer, uuid, text) is
  'Posts one Purchase receipt event: debits 1200 Inventory Asset (inventory-linked lines) or 6290 Non-Inventory Purchase Items (others), credits 2000 Accounts Payable, for unit_cost_minor * this call''s quantity only. source_id is purchase_item_id (the operational source document); idempotency is carried separately by posting_key = purchase_receipt:<receipt_event_id>, scoped per-workspace by the (workspace_id, posting_key) unique index, since source_id is not unique per receipt event (one item may receive several legitimate partial-receipt postings).';

create or replace function public.record_purchase_receipt(
  p_purchase_item_id uuid,
  p_quantity_received integer,
  p_reason text,
  p_actor text,
  p_receipt_event_id uuid
)
returns public.purchase_items
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_item public.purchase_items;
  v_purchase public.purchases;
  v_posting_key text;
  v_next_received integer;
  v_subtotal_minor integer;
  v_total_minor integer;
  v_total_ordered integer;
  v_total_received integer;
  v_next_status text;
  v_next_actual_received_date timestamptz;
  v_movement public.inventory_movements;
begin
  if p_quantity_received <= 0 then
    raise exception 'Quantity received must be greater than zero.' using errcode = 'P0005';
  end if;

  if p_receipt_event_id is null then
    raise exception 'p_receipt_event_id is required and must be a stable identifier supplied by the caller (the same value on every retry of the same receipt event).' using errcode = 'P0010';
  end if;

  select * into v_item from public.purchase_items where id = p_purchase_item_id for update;
  if not found then
    raise exception 'Purchase item not found.' using errcode = 'P0006';
  end if;

  select * into v_purchase from public.purchases where id = v_item.purchase_id for update;
  if not found then
    raise exception 'Purchase not found.' using errcode = 'P0006';
  end if;

  -- Idempotent replay check: a repeat of an already-completed receipt event
  -- returns the current row unchanged rather than re-running any of the
  -- mutations below. See this file's header for why this is a replay, not
  -- a duplicate-posting error, and why the purchase_items lock above is
  -- sufficient for concurrency safety on its own.
  v_posting_key := 'purchase_receipt:' || p_receipt_event_id;
  if exists (select 1 from public.journal_entries where workspace_id = v_purchase.workspace_id and posting_key = v_posting_key) then
    return v_item;
  end if;

  if v_purchase.archived_at is not null then
    raise exception 'Archived purchases cannot receive stock.' using errcode = 'P0007';
  end if;

  if v_purchase.status not in ('submitted', 'partially_received') then
    raise exception 'This purchase cannot receive stock in its current status.' using errcode = 'P0008';
  end if;

  v_next_received := v_item.quantity_received + p_quantity_received;
  if v_next_received > v_item.quantity_ordered then
    raise exception 'Quantity received cannot exceed quantity ordered.' using errcode = 'P0009';
  end if;

  -- Inventory-linked line: reuse the existing, already-atomic movement RPC
  -- rather than re-deriving its delta/quantity-invariant logic. A
  -- non-inventory line has nothing for Inventory to do.
  if v_item.inventory_item_id is not null then
    select public.record_inventory_movement(
      v_item.inventory_item_id,
      'purchase',
      p_quantity_received,
      coalesce(p_reason, 'Received against ' || v_purchase.purchase_number),
      'purchase',
      v_purchase.id::text,
      p_actor
    ) into v_movement;
  end if;

  update public.purchase_items
  set quantity_received = v_next_received,
      updated_at = now()
  where id = p_purchase_item_id
  returning * into v_item;

  select coalesce(sum(line_subtotal_minor), 0), coalesce(sum(quantity_ordered), 0), coalesce(sum(quantity_received), 0)
  into v_subtotal_minor, v_total_ordered, v_total_received
  from public.purchase_items
  where purchase_id = v_purchase.id;

  v_total_minor := v_subtotal_minor + v_purchase.tax_minor + v_purchase.shipping_minor - v_purchase.discount_minor;

  v_next_actual_received_date := v_purchase.actual_received_date;
  if v_total_received >= v_total_ordered and v_total_ordered > 0 then
    v_next_status := 'fully_received';
    v_next_actual_received_date := coalesce(v_next_actual_received_date, now());
  elsif v_total_received > 0 then
    v_next_status := 'partially_received';
    v_next_actual_received_date := null;
  else
    v_next_status := 'submitted';
    v_next_actual_received_date := null;
  end if;

  update public.purchases
  set subtotal_minor = v_subtotal_minor,
      total_minor = v_total_minor,
      status = v_next_status,
      actual_received_date = v_next_actual_received_date,
      updated_at = now()
  where id = v_purchase.id;

  insert into public.timeline_activities (workspace_id, owner_type, owner_id, type, description, actor, metadata)
  values (
    v_purchase.workspace_id, 'purchase', v_purchase.id, 'purchase_item_received',
    'Received ' || p_quantity_received || ' × "' || v_item.name || '"', p_actor,
    jsonb_build_object('purchase_item_id', p_purchase_item_id, 'quantity_received', p_quantity_received)
  );

  -- Posting failure (missing account, missing period, duplicate event id)
  -- rolls back everything above, including the quantity_received/status/
  -- Timeline changes just made — no new transaction boundary.
  perform public.post_purchase_receipt(p_purchase_item_id, p_quantity_received, p_receipt_event_id, p_actor);

  return v_item;
end;
$$;

comment on function public.record_purchase_receipt(uuid, integer, text, text, uuid) is
  'Atomic, row-locked receiving operation: replays (rather than errors on) a repeat p_receipt_event_id before any mutation, validates the purchase and quantity, records an Inventory movement via record_inventory_movement() when the line is Inventory-linked, updates the line''s quantity_received, recomputes the parent Purchase''s totals/status/actual_received_date, logs one Timeline entry, and posts the financial impact via post_purchase_receipt() — all in one transaction. p_receipt_event_id is required (no default): the caller must supply the same value on every retry of the same logical receipt event for idempotent replay to hold.';
