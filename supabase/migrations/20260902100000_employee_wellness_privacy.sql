-- Personal Wellness Privacy Foundation — employee mood check-ins, water
-- tracker, and private employee-to-founder notes.
--
-- The defining rule for employee_wellness_checkins and employee_water_logs
-- is that RLS here has NO owner/admin carve-out anywhere — unlike every
-- other workspace table in this schema (profiles_select_own is the closest
-- precedent, and even that one has no exception either). A Founder/Admin's
-- own authenticated session gets zero rows back querying these two tables
-- for anyone but themselves; there is no "and also visible to the owner"
-- clause to ever add. Each policy additionally requires
-- `public.is_workspace_member(workspace_id)` (active membership only,
-- reusing the same helper every other workspace-scoped policy in this
-- schema already relies on) alongside the self-only check, so a still-valid
-- session belonging to a member whose workspace_members row has since gone
-- inactive/removed loses access to their own historical rows too — the
-- privacy invariant is SELF *and* ACTIVE MEMBERSHIP, never SELF *or* ADMIN.
-- notes_to_founder is the deliberate opposite shape — author-or-founder
-- read access — kept in its own table so its broader visibility can never
-- leak into the strictly self-only wellness tables.
--
-- notes_to_founder is permanently append-only by product decision: it has
-- no UPDATE or DELETE policy anywhere in this file, and none should ever be
-- added. With RLS enabled and no such policy, Postgres fails closed —
-- nobody, including the author or a Founder/Admin, can update or delete a
-- note through the API. A note, once sent, is never edited or retracted.

create table if not exists public.employee_wellness_checkins (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  member_id     uuid not null references auth.users (id) on delete cascade,
  checkin_date  date not null,
  mood          text not null check (mood in ('great', 'good', 'calm', 'happy', 'focused', 'tired', 'low_energy', 'stressed', 'overwhelmed', 'prefer_not_to_say')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (member_id, checkin_date)
);

comment on table public.employee_wellness_checkins is
  'One row per employee per day. Private to the authoring employee only, and only while their workspace membership is active — see RLS below. Never joined into any Founder/Admin-facing report, dashboard, or export.';

create table if not exists public.employee_water_logs (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  member_id     uuid not null references auth.users (id) on delete cascade,
  log_date      date not null,
  glasses       int not null default 0 check (glasses >= 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (member_id, log_date)
);

comment on table public.employee_water_logs is
  'One row per employee per day. Private to the authoring employee only, and only while their workspace membership is active — see RLS below. Never joined into any Founder/Admin-facing report, dashboard, or export.';

create index if not exists employee_wellness_checkins_member_date_idx on public.employee_wellness_checkins (member_id, checkin_date);
create index if not exists employee_water_logs_member_date_idx on public.employee_water_logs (member_id, log_date);

alter table public.employee_wellness_checkins enable row level security;
alter table public.employee_water_logs enable row level security;

-- No founder/admin exception, deliberately — this is the core privacy
-- guarantee. member_id = auth.uid() and nothing else on the identity side,
-- on select/insert/update/delete alike (`for all`). is_workspace_member()
-- additionally requires the caller's membership to currently be active, so
-- a removed/deactivated member's still-valid session cannot keep reading or
-- writing their own historical rows either.
create policy "wellness_checkins_self_only"
  on public.employee_wellness_checkins for all
  to authenticated
  using (member_id = auth.uid() and public.is_workspace_member(workspace_id))
  with check (member_id = auth.uid() and public.is_workspace_member(workspace_id));

create policy "water_logs_self_only"
  on public.employee_water_logs for all
  to authenticated
  using (member_id = auth.uid() and public.is_workspace_member(workspace_id))
  with check (member_id = auth.uid() and public.is_workspace_member(workspace_id));

create trigger trg_employee_wellness_checkins_set_updated_at
  before update on public.employee_wellness_checkins
  for each row execute function public.set_updated_at();

create trigger trg_employee_water_logs_set_updated_at
  before update on public.employee_water_logs
  for each row execute function public.set_updated_at();

-- notes_to_founder: the intentional opposite shape from the two tables
-- above — an employee writes a private note that only they and the
-- workspace's owner/admin can read. Never reuses the generic
-- workspace-wide `notes` table (wrong visibility model for this).
create table if not exists public.notes_to_founder (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  author_id     uuid not null references auth.users (id) on delete cascade,
  body          text not null check (char_length(btrim(body)) > 0),
  created_at    timestamptz not null default now()
);

comment on table public.notes_to_founder is
  'A private employee -> Founder/Admin note. Permanently append-only by product decision — no UPDATE or DELETE policy exists or should ever be added; Postgres RLS fails closed, so a note can never be edited or retracted once sent. Never carries mood or water-tracker data — the employee writes free text only, nothing auto-attaches (see application layer).';

create index if not exists notes_to_founder_workspace_created_idx on public.notes_to_founder (workspace_id, created_at desc);

alter table public.notes_to_founder enable row level security;

create policy "notes_to_founder_select_author_or_founder"
  on public.notes_to_founder for select
  to authenticated
  using (author_id = auth.uid() or public.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy "notes_to_founder_insert_author"
  on public.notes_to_founder for insert
  to authenticated
  with check (author_id = auth.uid());

-- Deliberately no update/delete policy on notes_to_founder — see the table
-- comment and this file's header comment. Do not add one.
