-- Purchases Receiving RPC phase: atomic receipt-recording function.
--
-- Eliminates the concurrency gap the Supabase Purchases repository's
-- receivePurchaseItem() previously carried as a disclosed limitation: that
-- implementation performed the Inventory movement RPC call, the
-- purchase_items update, and the purchases aggregate recompute as three
-- separate, non-atomic network round-trips, so two concurrent receipts
-- against different items of the same Purchase could race on the final
-- aggregate write (subtotal_minor/total_minor/status/actual_received_date).
-- This function wraps all of it in one transaction with row-level locking,
-- the same class of problem record_inventory_movement/
-- recompute_invoice_balance/create_document_version already solve.
--
-- Composes record_inventory_movement() directly (a plain PL/pgSQL function
-- call, not a second HTTP round-trip) rather than re-deriving its delta/
-- quantity-invariant logic — a function call from within another
-- `security invoker` function runs in the very same transaction, so the
-- inner function's own `for update` lock on inventory_items is held for the
-- lifetime of this outer transaction, and a later raise in this function
-- rolls back the inventory movement and update together with everything
-- else. There is no PostgreSQL limitation forcing a second implementation
-- of Inventory's movement math here.
--
-- Locking order: purchase_items -> purchases -> inventory_items (acquired
-- inside record_inventory_movement). This is the natural dependency chain
-- (the item's purchase_id is needed before the purchase can be locked) and
-- no other function in this schema acquires these three locks in a
-- different order, so this introduces no deadlock cycle. Locking the
-- purchases row here is what actually closes the race: two concurrent
-- receipts against different items of the same Purchase now serialize on
-- that single row, so the aggregate recompute below can never be based on
-- a stale read.
--
-- Workspace validation is enforced structurally through RLS on the two
-- `for update` selects (purchase_items_update_workspace_member/
-- purchases_update_workspace_member) — the same no-explicit-workspace-
-- parameter design record_inventory_movement itself already uses — never a
-- separate p_workspace_id parameter.
--
-- Error codes (scoped to this function; distinct from record_inventory_
-- movement's own P0001-P0004, which may still surface unmodified if the
-- inner call fails, so a Purchase-level failure is never confused with an
-- Inventory-level one):
--   P0005 — quantity_received not greater than zero (defense in depth; the
--           zod schema already rejects this before the RPC is ever called)
--   P0006 — purchase item (or, defensively, its parent purchase) not found
--   P0007 — purchase is archived
--   P0008 — purchase is not in a receivable status (submitted or
--           partially_received)
--   P0009 — the receipt would exceed this line's quantity_ordered
--
-- Status/total recompute mirrors core/workflows/purchaseWorkflow.ts's
-- derivePurchaseReceiptStatus() exactly (sum-of-all-items ordered/received,
-- not a per-item check) and computePurchaseTotal()'s exact arithmetic
-- (subtotal + tax + shipping - discount) — that TypeScript function remains
-- the single source of truth for mock mode; this is its SQL-side
-- equivalent for Supabase mode, not a divergent second implementation.

create or replace function public.record_purchase_receipt(
  p_purchase_item_id uuid,
  p_quantity_received integer,
  p_reason text,
  p_actor text
)
returns public.purchase_items
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_item public.purchase_items;
  v_purchase public.purchases;
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

  select * into v_item from public.purchase_items where id = p_purchase_item_id for update;
  if not found then
    raise exception 'Purchase item not found.' using errcode = 'P0006';
  end if;

  select * into v_purchase from public.purchases where id = v_item.purchase_id for update;
  if not found then
    raise exception 'Purchase not found.' using errcode = 'P0006';
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

  return v_item;
end;
$$;

comment on function public.record_purchase_receipt(uuid, integer, text, text) is
  'Atomic, row-locked receiving operation: validates the purchase and quantity, records an Inventory movement via record_inventory_movement() when the line is Inventory-linked, updates the line''s quantity_received, recomputes the parent Purchase''s totals/status/actual_received_date, and logs one Timeline entry — all in one transaction. Locking the purchases row here is what serializes concurrent receipts against the same Purchase.';
