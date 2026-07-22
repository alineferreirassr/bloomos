-- Inventory Supabase Repository phase: atomic movement-recording function.
--
-- The mock repository's applyInventoryMovement() (lib/data/inventory/
-- mockRepository.ts) does four things per call: validate the item isn't
-- archived, compute the before/after quantities for the given
-- movement_type, update inventory_items' three quantity columns, and
-- insert one immutable inventory_movements row plus one Timeline entry.
-- In Supabase mode those are four separate network round-trips unless
-- wrapped in one transaction — exactly the class of problem
-- create_document_version/apply_default_event_checklist/
-- recompute_invoice_balance already solve the same way, so this reuses
-- that established approach rather than performing the update and the
-- insert as two independent, non-atomic REST calls from the client. Same
-- `security invoker` rationale as those: every read/write inside is still
-- governed by the caller's own RLS policies (inventory_items/
-- inventory_movements' workspace-member policies), no service_role
-- needed, and no explicit grant/revoke — matching the more recent
-- Finance/Documents helper-function migrations, which rely on RLS alone
-- rather than function-level grants.
--
-- Row-locks the target item (`for update`) so two concurrent movements
-- against the same item can never both read the same "before" quantities
-- and silently clobber each other — the second call's SELECT blocks until
-- the first transaction commits or rolls back.
--
-- Error codes (scoped to this function only, no cross-module meaning):
--   P0001 — quantity not greater than zero (defense in depth; the zod
--           schema already rejects this before the RPC is ever called)
--   P0002 — inventory item not found
--   P0003 — inventory item is archived
--   P0004 — the resulting quantities would violate an invariant (negative,
--           or available/reserved exceeding on-hand)
--
-- Movement-type -> quantity-delta mapping mirrors
-- core/workflows/inventoryWorkflow.ts's getInventoryMovementDelta() exactly
-- — that TypeScript function remains the single source of truth for mock
-- mode; this is its SQL-side equivalent for Supabase mode, not a
-- divergent second implementation.

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

  return v_movement;
end;
$$;

comment on function public.record_inventory_movement(uuid, text, integer, text, text, text, text) is
  'Atomic, row-locked equivalent of the mock''s applyInventoryMovement() — validates, updates inventory_items'' quantities, inserts one immutable inventory_movements row, and logs one Timeline entry, all in one transaction.';
