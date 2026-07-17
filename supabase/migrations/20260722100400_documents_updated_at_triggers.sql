-- Documents migration 5 of 8: updated_at triggers.
--
-- Reuses the generic public.set_updated_at() function defined in
-- 20260715150400_updated_at_trigger.sql — no bespoke function per table.

drop trigger if exists trg_documents_set_updated_at on public.documents;
create trigger trg_documents_set_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

drop trigger if exists trg_document_folders_set_updated_at on public.document_folders;
create trigger trg_document_folders_set_updated_at
  before update on public.document_folders
  for each row execute function public.set_updated_at();
