-- Documents migration 6 of 8: indexes and constraints.
--
-- Mirrors the query patterns getDocuments()/getDocumentsByOwner()/
-- getDocumentsByCategory()/getDocumentsByReference()/documentChain()/
-- getDocumentFolders()/getDocumentFolderTree() actually use: list-by-
-- workspace, filter by owner/status/category/folder, walk a version
-- chain, walk a folder tree.

create index if not exists documents_workspace_id_idx on public.documents (workspace_id);
create index if not exists documents_workspace_owner_idx on public.documents (workspace_id, owner_type, owner_id);
create index if not exists documents_workspace_status_idx on public.documents (workspace_id, status);
create index if not exists documents_category_idx on public.documents (category);
create index if not exists documents_folder_id_idx on public.documents (folder_id);
-- Supports documentChain()'s "every row in this chain" lookup (WHERE id = root OR parent_document_id = root).
create index if not exists documents_parent_document_id_idx on public.documents (parent_document_id);
create index if not exists documents_media_asset_id_idx on public.documents (media_asset_id);
create index if not exists documents_contract_exhibit_id_idx on public.documents (contract_exhibit_id);
create index if not exists documents_event_id_idx on public.documents (event_id);
create index if not exists documents_client_id_idx on public.documents (client_id);
create index if not exists documents_contract_id_idx on public.documents (contract_id);
create index if not exists documents_invoice_id_idx on public.documents (invoice_id);
create index if not exists documents_payment_id_idx on public.documents (payment_id);
create index if not exists documents_expense_id_idx on public.documents (expense_id);

create index if not exists document_folders_workspace_id_idx on public.document_folders (workspace_id);
create index if not exists document_folders_workspace_owner_idx on public.document_folders (workspace_id, owner_type, owner_id);
create index if not exists document_folders_parent_folder_id_idx on public.document_folders (parent_folder_id);
