-- CONTRACTS-02 — durable DocuSign envelope-id mapping.
--
-- The existing generic `integration_mappings` mechanism
-- (src/lib/data/core/integrations/mappingStore.ts) is mock-only with zero
-- real callers of insertMapping anywhere in the codebase — not a fit for a
-- new production write path. A contract can only ever have one active
-- outstanding envelope at a time (sendContractForSignatureAction already
-- rejects re-sending a contract whose signature_status isn't
-- unsigned/declined), so a single nullable column is the smallest durable
-- design, not a new table.
--
-- Written by sendContract() when set by sendContractForSignatureAction;
-- read by the new authenticated "check signature status" polling action to
-- resolve which DocuSign envelope to poll. Never read/written by the
-- inbound webhook route directly (see CONTRACTS-02 final report for why).

alter table public.contracts
  add column if not exists docusign_envelope_id text;

comment on column public.contracts.docusign_envelope_id is
  'The DocuSign envelope id returned by DocuSignProvider.createSignatureRequest() for this contract''s current (or most recent) signature request. Nullable — unset until sendContractForSignatureAction succeeds. One active envelope per contract at a time, matching the existing re-send idempotency rule.';
