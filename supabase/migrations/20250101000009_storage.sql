-- Storage bucket for asset documents. Objects are stored at
-- "{workspace_id}/{asset_id}/{filename}" — the RLS policies below parse
-- that first path segment to enforce the same workspace isolation as
-- every other table.

insert into storage.buckets (id, name, public)
values ('asset-documents', 'asset-documents', false)
on conflict (id) do nothing;

create policy "asset_documents_storage_select" on storage.objects
  for select using (
    bucket_id = 'asset-documents'
    and is_workspace_member((storage.foldername(name))[1]::uuid)
  );

create policy "asset_documents_storage_insert" on storage.objects
  for insert with check (
    bucket_id = 'asset-documents'
    and is_workspace_member((storage.foldername(name))[1]::uuid)
  );

create policy "asset_documents_storage_delete" on storage.objects
  for delete using (
    bucket_id = 'asset-documents'
    and is_workspace_member((storage.foldername(name))[1]::uuid)
  );
