-- CONTRACTS-03B — reconcile_docusign_envelope_status(): the one privileged
-- mutation surface CONTRACTS-03A's architecture audit authorized. Invoked
-- exclusively by the DocuSign webhook route's own trusted server-only
-- module (trustedReconciliation.ts), using the service-role client — never
-- by an ordinary user, and never reachable as `anon`/`authenticated`.
--
-- This is NOT the trust boundary — the webhook route's own HMAC
-- verification (against the connection's own stored Connect secret) is
-- what establishes trust, before this function is ever called. This
-- function's own job is atomicity: the Contract row update, its Timeline
-- entry, and the idempotency ledger write all happen inside one Postgres
-- function invocation (one implicit transaction — if anything after the
-- ledger insert were to fail, the whole thing rolls back together,
-- including the ledger row, so a genuine failure is safely retryable, not
-- permanently and silently suppressed).
--
-- Arguments are deliberately minimal and never trust the caller's own
-- notion of "which Contract" or "what status": p_connection_id +
-- p_envelope_id are how the Contract is *found* (via its own durable
-- docusign_envelope_id, cross-checked against the connection's own
-- workspace_id — never a caller-supplied workspace_id or contract_id), and
-- p_mapped_status is constrained by a CHECK to exactly the two terminal
-- outcomes this checkpoint's own polling path already normalizes to
-- ('signed' | 'declined') — never an arbitrary status string.
--
-- Preserves the exact same source-state legality markSigned()/
-- markDeclined() already enforce (only 'sent'/'viewed' may transition) —
-- this is not a second, looser lifecycle engine, it is the same rule,
-- reproduced once, for the one caller (a verified webhook) that cannot
-- reach the TypeScript version of that rule through a browser session.
create or replace function public.reconcile_docusign_envelope_status(
  p_connection_id uuid,
  p_envelope_id text,
  p_mapped_status text
)
returns table (mutated boolean, contract_id uuid, workspace_id uuid, client_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_connection_workspace_id uuid;
  v_contract public.contracts%rowtype;
  v_already_processed boolean := false;
  v_now timestamptz := now();
begin
  if p_mapped_status not in ('signed', 'declined') then
    raise exception 'Unsupported mapped status: %', p_mapped_status using errcode = 'P2001';
  end if;

  select workspace_id into v_connection_workspace_id
  from public.integration_connections
  where id = p_connection_id;

  if v_connection_workspace_id is null then
    return query select false, null::uuid, null::uuid, null::uuid;
    return;
  end if;

  select * into v_contract
  from public.contracts
  where docusign_envelope_id = p_envelope_id
  limit 1;

  if not found or v_contract.workspace_id is distinct from v_connection_workspace_id then
    return query select false, null::uuid, null::uuid, null::uuid;
    return;
  end if;

  -- Idempotency: a unique-violation here means this exact triple was
  -- already reconciled by an earlier delivery — treat it as a safe no-op,
  -- never a second mutation, and never an error the webhook route needs
  -- to distinguish from "nothing to do".
  begin
    insert into public.docusign_webhook_reconciliations (connection_id, envelope_id, mapped_status, contract_id, processed_at)
    values (p_connection_id, p_envelope_id, p_mapped_status, v_contract.id, v_now);
  exception when unique_violation then
    v_already_processed := true;
  end;

  if v_already_processed then
    return query select false, v_contract.id, v_contract.workspace_id, v_contract.client_id;
    return;
  end if;

  if v_contract.signature_status not in ('sent', 'viewed') then
    -- Already resolved by another path (admin override, prior reconciliation
    -- under a different mapped_status, etc.) or never actually sent — no
    -- mutation, but the ledger row inserted above still remembers this
    -- exact notification was seen, so a repeat of it stays a no-op too.
    return query select false, v_contract.id, v_contract.workspace_id, v_contract.client_id;
    return;
  end if;

  if p_mapped_status = 'signed' then
    update public.contracts
    set status = 'signed', signature_status = 'signed', signed_at = v_now, updated_at = v_now
    where id = v_contract.id;

    insert into public.timeline_activities (workspace_id, owner_type, owner_id, type, description, actor)
    values (v_contract.workspace_id, 'contract', v_contract.id, 'contract_signed', 'Contract signed: "' || v_contract.title || '"', 'docusign-webhook');
  else
    update public.contracts
    set status = 'declined', signature_status = 'declined', declined_at = v_now, updated_at = v_now
    where id = v_contract.id;

    insert into public.timeline_activities (workspace_id, owner_type, owner_id, type, description, actor)
    values (v_contract.workspace_id, 'contract', v_contract.id, 'contract_declined', 'Contract declined: "' || v_contract.title || '"', 'docusign-webhook');
  end if;

  return query select true, v_contract.id, v_contract.workspace_id, v_contract.client_id;
end;
$$;

comment on function public.reconcile_docusign_envelope_status(uuid, text, text) is
  'Security definer, service_role only: atomically reconciles a verified DocuSign envelope status onto its own Contract (found via docusign_envelope_id, cross-checked against the connection''s workspace_id), enforcing the same source-state legality as markSigned()/markDeclined() and recording one idempotency ledger row per (connection, envelope, mapped_status) triple. Never accepts a contract id or an arbitrary status. Not the trust boundary — the calling webhook route''s own HMAC verification is.';

revoke all on function public.reconcile_docusign_envelope_status(uuid, text, text) from public;
grant execute on function public.reconcile_docusign_envelope_status(uuid, text, text) to service_role;
