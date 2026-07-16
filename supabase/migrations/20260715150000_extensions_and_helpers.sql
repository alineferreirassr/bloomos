-- Supabase Foundation — migration 1 of 8: extensions and generic helpers.
--
-- pgcrypto provides gen_random_uuid(), used as the default for every
-- primary key in this schema (docs/database.md: "UUID primary keys
-- everywhere, generated server-side").
create extension if not exists pgcrypto with schema extensions;
