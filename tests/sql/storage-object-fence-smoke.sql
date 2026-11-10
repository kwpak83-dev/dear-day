\set ON_ERROR_STOP on
\ir ../../supabase/migrations/202611090017_invitation_storage_object_fence.sql

do $test$
declare
  v_owner uuid := '11111111-1111-4111-8111-111111111111';
  v_event uuid := '55555555-5555-4555-8555-555555555555';
  v_path text := v_owner::text || '/fence-smoke.jpg';
  v_reservation uuid;
  v_state text;
begin
  insert into public.events(id, owner_id, status) values (v_event, v_owner, 'draft');
  v_reservation := public.reserve_invitation_upload(v_event, v_owner, 'invitation-photos', v_path);
  if not public.finish_invitation_upload(v_reservation, v_owner, true) then
    raise exception 'Normal reservation cannot finish';
  end if;
  insert into public.invitation_storage_object_references values (v_event, 'invitation-photos', v_path);
  delete from public.invitation_storage_object_references where event_id = v_event;

  foreach v_state in array array['deletion_pending', 'deleting', 'deleted'] loop
    update public.invitation_storage_objects set state = v_state where storage_path = v_path;
    begin
      insert into public.invitation_storage_object_references values (v_event, 'invitation-photos', v_path);
      raise exception 'New reference bypassed the fence';
    exception when check_violation then null;
    end;
    begin
      perform public.reserve_invitation_upload(v_event, v_owner, 'invitation-photos', v_path);
      raise exception 'New reservation bypassed the fence';
    exception when check_violation then null;
    end;
  end loop;

  if has_table_privilege('service_role', 'public.invitation_storage_objects', 'UPDATE') then
    raise exception 'Service role can transition objects without a guarded RPC';
  end if;
end;
$test$;
