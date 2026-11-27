-- Apply separately before enabling administrator replies. Existing table grants stay intact.
begin;
create function public.answer_customer_inquiry(p_inquiry uuid, p_reply uuid, p_admin uuid, p_content text)
returns void language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required' using errcode='42501';
  end if;
  perform 1 from public.inquiries where id=p_inquiry for update;
  if not found then raise exception 'Inquiry not found' using errcode='P0002'; end if;
  insert into public.inquiry_replies(id, inquiry_id, admin_id, content)
  values (p_reply,p_inquiry,p_admin,p_content) on conflict (id) do nothing;
  if not found then
    if not exists (select 1 from public.inquiry_replies where id=p_reply and inquiry_id=p_inquiry
      and admin_id=p_admin and content=p_content) then
      raise exception 'Reply request conflict' using errcode='23505';
    end if;
    return;
  end if;
  update public.inquiries set status='answered', answered_at=clock_timestamp() where id=p_inquiry;
end;
$$;
revoke all on function public.answer_customer_inquiry(uuid,uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.answer_customer_inquiry(uuid,uuid,uuid,text) to service_role;
commit;
