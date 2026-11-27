-- Attachment schema was provisioned separately in production. Safe for new DBs and already provisioned DBs.
begin;
alter table public.inquiries add column if not exists attachments jsonb not null default '[]'::jsonb;
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.inquiries'::regclass and conname='inquiries_attachments_check') then
    alter table public.inquiries add constraint inquiries_attachments_check check (
      case when jsonb_typeof(attachments)='array' then jsonb_array_length(attachments)<=3 else false end
    );
  end if;
end;
$$;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('inquiry-attachments','inquiry-attachments',false,512000,array['image/webp'])
on conflict (id) do nothing;
commit;
