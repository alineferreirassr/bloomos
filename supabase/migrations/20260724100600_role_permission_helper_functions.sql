-- Team foundation migration 7 of 11: role/permission helper functions and
-- protective triggers.
--
-- has_permission() is the granular counterpart to has_workspace_role() —
-- same security definer/stable/search_path shape and the same recursion
-- rationale (evaluating it from inside a workspace_members-referencing RLS
-- policy would otherwise recurse into workspace_members' own RLS).
--
-- The two triggers below enforce, at the database level, the two
-- invariants that must never depend on RLS alone: a Workspace can never be
-- left with zero active owners, and no non-owner can grant or touch the
-- owner role. Both fire BEFORE UPDATE OR DELETE on workspace_members, so
-- they catch every write path (direct RLS-gated UPDATE/DELETE from an
-- authorized admin, not just app-layer checks) — "enforced at the database
-- level where practical" per the approved design.

create or replace function public.has_permission(p_workspace_id uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members m
    join public.role_permissions rp on rp.role_id = m.role
    where m.workspace_id = p_workspace_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and rp.permission_id = p_permission
  );
$$;

comment on function public.has_permission(uuid, text) is
  'True iff the current auth.uid() has an active membership in the given Workspace whose role is granted the given permission.';

create or replace function public.protect_workspace_owners()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_acting_role text;
  v_other_active_owners integer;
begin
  -- Role escalation: only an existing owner may grant the owner role, and
  -- only an existing owner may modify a row that is currently an owner's
  -- (covers demotion, deactivation, and removal in one check — admin
  -- cannot touch an owner's row at all, matching "cannot remove or demote
  -- the owner").
  select role into v_acting_role
  from public.workspace_members
  where workspace_id = coalesce(new.workspace_id, old.workspace_id)
    and user_id = auth.uid()
    and status = 'active';

  if v_acting_role is distinct from 'owner' then
    if tg_op = 'UPDATE' and new.role = 'owner' and old.role is distinct from 'owner' then
      raise exception 'Only an owner can grant the owner role.' using errcode = 'P0011';
    end if;
    if old.role = 'owner' then
      raise exception 'Only an owner can modify another owner''s membership.' using errcode = 'P0012';
    end if;
  end if;

  -- Last-owner protection: block any change that would leave zero active
  -- owners in the Workspace — a demotion, a deactivation, or a removal.
  if old.role = 'owner' and old.status = 'active' then
    if (tg_op = 'DELETE') or (new.role is distinct from 'owner') or (new.status is distinct from 'active') then
      select count(*) into v_other_active_owners
      from public.workspace_members
      where workspace_id = old.workspace_id
        and role = 'owner'
        and status = 'active'
        and id != old.id;

      if v_other_active_owners = 0 then
        raise exception 'The last active owner cannot be removed, demoted, or deactivated.' using errcode = 'P0013';
      end if;
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

comment on function public.protect_workspace_owners() is
  'BEFORE UPDATE OR DELETE trigger on workspace_members: prevents role escalation to/around the owner role by non-owners, and prevents the last active owner from being demoted, deactivated, or removed.';

drop trigger if exists trg_protect_workspace_owners on public.workspace_members;
create trigger trg_protect_workspace_owners
  before update or delete on public.workspace_members
  for each row execute function public.protect_workspace_owners();

-- Invitation-time role-escalation guard: an admin may only invite manager
-- or staff (never owner, never another admin — "cannot promote anyone to
-- owner" and admin's own granted authority is scoped to manager/staff
-- roles); only an owner may invite owner or admin. RLS' own
-- has_permission(workspace_id, 'team.invite') check (migration 10) already
-- keeps manager/staff from reaching this insert at all — this is the
-- finer-grained rule RLS' single boolean can't express on its own.
create or replace function public.validate_invitation_role_authority()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_acting_role text;
begin
  select role into v_acting_role
  from public.workspace_members
  where workspace_id = new.workspace_id
    and user_id = auth.uid()
    and status = 'active';

  if v_acting_role = 'owner' then
    return new;
  end if;

  if v_acting_role = 'admin' and new.invited_role in ('manager', 'staff') then
    return new;
  end if;

  raise exception 'You are not authorized to invite someone as %.', new.invited_role using errcode = 'P0014';
end;
$$;

comment on function public.validate_invitation_role_authority() is
  'BEFORE INSERT trigger on workspace_invitations: only an owner may invite an owner or admin; an admin may only invite manager or staff.';

drop trigger if exists trg_validate_invitation_role_authority on public.workspace_invitations;
create trigger trg_validate_invitation_role_authority
  before insert on public.workspace_invitations
  for each row execute function public.validate_invitation_role_authority();
