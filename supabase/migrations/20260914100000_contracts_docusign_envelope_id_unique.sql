-- CONTRACTS-03B — enforce contracts.docusign_envelope_id uniqueness.
--
-- CONTRACTS-02 added this column nullable, with no uniqueness guarantee
-- (CONTRACTS-03A's own architecture audit flagged this as a required fix
-- before any envelope-id-keyed webhook lookup could safely trust "exactly
-- one row"). Confirmed safe to add now, not merely assumed: the column was
-- introduced in this same session; sendContractForSignatureAction (the
-- only production code path that ever writes a non-null value here) was
-- unreachable from any UI until CONTRACTS-02 shipped, in this same
-- session; live DocuSign has never been exercised against this project
-- (DOCUSIGN_LIVE_QA remains UNVERIFIED); and every mock seed Contract has
-- docusign_envelope_id = null. There is no evidence of, and strong
-- circumstantial evidence against, any existing duplicate non-null value.
--
-- This migration has no live production connection to query directly (see
-- CONTRACTS-03A/03B's own disclosed environment limitation) — if a
-- duplicate somehow exists despite the above, this migration fails loudly
-- with Postgres's own unique-index-creation error rather than silently
-- deduplicating, dropping, or renumbering any row.
create unique index if not exists contracts_docusign_envelope_id_unique_idx
  on public.contracts (docusign_envelope_id)
  where docusign_envelope_id is not null;
