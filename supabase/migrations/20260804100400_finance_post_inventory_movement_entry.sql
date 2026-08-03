-- Finance Posting Engine migration 5 of 9: post_inventory_movement_entry +
-- composition into the existing record_inventory_movement.
--
-- Movement types with financial impact, per the approved Event Matrix:
--   initial_stock     -> Debit 1200 Inventory Asset,  Credit 3000 Owner's Equity
--   adjustment_increase -> Debit 1200,                 Credit 7100 Inventory Adjustment Gain
--   adjustment_decrease -> Debit 5100 Inventory Shrinkage/Write-off, Credit 1200
--   event_checkout    -> Debit 5000 Cost of Goods Sold, Credit 1200
--   event_return      -> Debit 1200,                    Credit 5000 Cost of Goods Sold
--   damage / loss / disposal -> Debit 5100,             Credit 1200
--
-- Movement types that intentionally produce no posting:
--   reservation, reservation_release — earmarking only, no value transfer.
--   purchase — deliberately NOT posted here. This financial event is owned
--     by post_purchase_receipt (composed into record_purchase_receipt),
--     which already debits 1200/6290 and credits 2000 for the same
--     receiving event. Posting it again here from the Inventory side would
--     double-count the same money movement.
--
-- Amount = quantity * inventory_items.unit_cost. unit_cost is nullable
-- (an item that has never had a cost recorded) — posting is refused with a
-- clear error rather than valuing the movement at zero, which would
-- silently understate the ledger.
--
-- Called from inside record_inventory_movement, after the existing
-- inventory_movements insert (the movement row itself is this posting's
-- source document) and after the existing Timeline insert, all within the
-- same transaction. The inventory_items row is already locked by
-- record_inventory_movement's own existing `for update` — no new lock
-- needed here.

create or replace function public.post_inventory_movement_entry(
  p_inventory_movement_id uuid,
  p_actor text
)
returns public.journal_entries
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_movement public.inventory_movements;
  v_item public.inventory_items;
  v_source_type text;
  v_posting_key text;
  v_debit_number integer;
  v_credit_number integer;
  v_amount_minor integer;
  v_debit_account public.chart_of_accounts;
  v_credit_account public.chart_of_accounts;
  v_entry public.journal_entries;
begin
  select * into v_movement from public.inventory_movements where id = p_inventory_movement_id;
  if not found then
    raise exception 'Inventory movement not found.' using errcode = 'P1111';
  end if;

  -- No-posting movement types: return without creating a Journal Entry.
  if v_movement.movement_type in ('reservation', 'reservation_release', 'purchase') then
    return null;
  end if;

  v_source_type := case v_movement.movement_type
    when 'initial_stock' then 'inventory_initial_stock'
    when 'adjustment_increase' then 'inventory_adjustment'
    when 'adjustment_decrease' then 'inventory_adjustment'
    when 'event_checkout' then 'inventory_event_checkout'
    when 'event_return' then 'inventory_event_return'
    when 'damage' then 'inventory_writeoff'
    when 'loss' then 'inventory_writeoff'
    when 'disposal' then 'inventory_writeoff'
    else null
  end;

  if v_source_type is null then
    raise exception 'Unsupported Inventory movement type for posting: %.', v_movement.movement_type using errcode = 'P1110';
  end if;

  if exists (select 1 from public.journal_entries where source_type = v_source_type and source_id = p_inventory_movement_id::text) then
    raise exception 'This Inventory movement has already been posted.' using errcode = 'P1104';
  end if;

  v_posting_key := 'inventory_movement:' || p_inventory_movement_id;

  select * into v_item from public.inventory_items where id = v_movement.inventory_item_id;
  if not found then
    raise exception 'Inventory item not found.' using errcode = 'P1111';
  end if;

  if v_item.unit_cost is null then
    raise exception 'Inventory item "%" has no unit_cost recorded; cannot value this movement for posting.', v_item.name
      using errcode = 'P1111';
  end if;

  v_amount_minor := v_movement.quantity * v_item.unit_cost;

  v_debit_number := case v_movement.movement_type
    when 'initial_stock' then 1200
    when 'adjustment_increase' then 1200
    when 'adjustment_decrease' then 5100
    when 'event_checkout' then 5000
    when 'event_return' then 1200
    when 'damage' then 5100
    when 'loss' then 5100
    when 'disposal' then 5100
  end;

  v_credit_number := case v_movement.movement_type
    when 'initial_stock' then 3000
    when 'adjustment_increase' then 7100
    when 'adjustment_decrease' then 1200
    when 'event_checkout' then 1200
    when 'event_return' then 5000
    when 'damage' then 1200
    when 'loss' then 1200
    when 'disposal' then 1200
  end;

  v_debit_account := public.finance_resolve_account(v_item.workspace_id, v_debit_number);
  v_credit_account := public.finance_resolve_account(v_item.workspace_id, v_credit_number);

  v_entry := public.finance_insert_journal_entry(
    v_item.workspace_id,
    (v_movement.occurred_at at time zone 'utc')::date,
    v_source_type,
    p_inventory_movement_id::text,
    'Inventory ' || v_movement.movement_type || ': "' || v_item.name || '" × ' || v_movement.quantity,
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

comment on function public.post_inventory_movement_entry(uuid, text) is
  'Posts the financial impact of a financially-relevant Inventory movement (initial_stock, adjustment_increase/decrease, event_checkout/return, damage/loss/disposal). Returns null without posting for reservation/reservation_release/purchase (the last owned by post_purchase_receipt instead, to avoid double-counting). One posting per movement row, enforced by the existing source_type/source_id unique index plus a pre-check; also carries a deterministic posting_key (inventory_movement:<movement_id>) for the newer workspace-scoped idempotency mechanism.';

create or replace function public.record_inventory_movement(
  p_inventory_item_id uuid,
  p_movement_type text,
  p_quantity integer,
  p_reason text,
  p_reference_type text,
  p_reference_id text,
  p_actor text
)
returns public.inventory_movements
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_item public.inventory_items;
  v_delta_on_hand integer;
  v_delta_available integer;
  v_delta_reserved integer;
  v_next_on_hand integer;
  v_next_available integer;
  v_next_reserved integer;
  v_quantity_before integer;
  v_movement_label text;
  v_movement public.inventory_movements;
begin
  if p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero.' using errcode = 'P0001';
  end if;

  select * into v_item from public.inventory_items where id = p_inventory_item_id for update;
  if not found then
    raise exception 'Inventory item not found.' using errcode = 'P0002';
  end if;
  if v_item.archived_at is not null then
    raise exception 'Archived inventory items cannot receive stock movements. Restore it first.' using errcode = 'P0003';
  end if;

  v_delta_on_hand := case
    when p_movement_type in ('initial_stock', 'purchase', 'adjustment_increase', 'event_return') then p_quantity
    when p_movement_type in ('adjustment_decrease', 'damage', 'loss', 'disposal', 'event_checkout') then -p_quantity
    else 0
  end;

  v_delta_available := case
    when p_movement_type in ('initial_stock', 'purchase', 'adjustment_increase', 'event_return') then p_quantity
    when p_movement_type in ('adjustment_decrease', 'damage', 'loss', 'disposal') then -p_quantity
    when p_movement_type = 'reservation' then -p_quantity
    when p_movement_type = 'reservation_release' then p_quantity
    else 0
  end;

  v_delta_reserved := case
    when p_movement_type = 'reservation' then p_quantity
    when p_movement_type = 'reservation_release' then -p_quantity
    when p_movement_type = 'event_checkout' then -p_quantity
    else 0
  end;

  v_quantity_before := v_item.quantity_on_hand;
  v_next_on_hand := v_item.quantity_on_hand + v_delta_on_hand;
  v_next_available := v_item.quantity_available + v_delta_available;
  v_next_reserved := v_item.quantity_reserved + v_delta_reserved;

  if v_next_on_hand < 0 or v_next_available < 0 or v_next_reserved < 0 then
    raise exception 'Quantities cannot be negative.' using errcode = 'P0004';
  end if;
  if v_next_available > v_next_on_hand then
    raise exception 'Quantity available cannot exceed quantity on hand.' using errcode = 'P0004';
  end if;
  if v_next_reserved > v_next_on_hand then
    raise exception 'Quantity reserved cannot exceed quantity on hand.' using errcode = 'P0004';
  end if;

  update public.inventory_items
  set quantity_on_hand = v_next_on_hand,
      quantity_available = v_next_available,
      quantity_reserved = v_next_reserved,
      updated_at = now()
  where id = p_inventory_item_id;

  insert into public.inventory_movements (
    workspace_id, inventory_item_id, movement_type, quantity, quantity_before, quantity_after,
    reason, reference_type, reference_id, performed_by
  ) values (
    v_item.workspace_id, p_inventory_item_id, p_movement_type, p_quantity, v_quantity_before, v_next_on_hand,
    p_reason, p_reference_type, p_reference_id, p_actor
  )
  returning * into v_movement;

  v_movement_label := case p_movement_type
    when 'initial_stock' then 'Initial stock'
    when 'purchase' then 'Purchase'
    when 'adjustment_increase' then 'Adjustment (increase)'
    when 'adjustment_decrease' then 'Adjustment (decrease)'
    when 'reservation' then 'Reservation'
    when 'reservation_release' then 'Reservation released'
    when 'event_checkout' then 'Checked out for Event'
    when 'event_return' then 'Returned from Event'
    when 'damage' then 'Damage'
    when 'loss' then 'Loss'
    when 'disposal' then 'Disposal'
    else p_movement_type
  end;

  insert into public.timeline_activities (workspace_id, owner_type, owner_id, type, description, actor, metadata)
  values (
    v_item.workspace_id, 'inventory_item', p_inventory_item_id, 'inventory_movement_recorded',
    v_movement_label || ': ' || p_quantity, p_actor,
    jsonb_build_object('movement_type', p_movement_type, 'quantity', p_quantity)
  );

  -- Posting failure (e.g. missing unit_cost, missing account) rolls back
  -- the quantity update, the movement row, and the Timeline entry along
  -- with it — no new transaction boundary.
  perform public.post_inventory_movement_entry(v_movement.id, p_actor);

  return v_movement;
end;
$$;

comment on function public.record_inventory_movement(uuid, text, integer, text, text, text, text) is
  'Atomic, row-locked equivalent of the mock''s applyInventoryMovement() — validates, updates inventory_items'' quantities, inserts one immutable inventory_movements row, logs one Timeline entry, and posts the financial impact via post_inventory_movement_entry() when the movement type has one, all in one transaction.';
