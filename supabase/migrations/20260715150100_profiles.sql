-- Supabase Foundation — migration 2 of 8: profiles.
--
-- One row per Supabase Auth user (`auth.users.id`). Provisioned automatically
-- by the handle_new_user() trigger below — never inserted directly by
-- application code. RLS is enabled in migration 7, once the shared
-- updated_at trigger (migration 5) and workspace helper functions
-- (migration 6) both exist.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'One row per auth.users row. Populated by handle_new_user() on signup, never inserted directly by application code.';

-- Provisions a profile row the moment a new Supabase Auth user is created —
-- runs as security definer because auth.users triggers execute before the
-- new user's own session exists to satisfy any RLS check.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_handle_new_user on auth.users;
create trigger trg_handle_new_user
  after insert on auth.users
  for each row execute function public.handle_new_user();
