-- Phase 1: manually issued invitation credits. Apply before enabling credit APIs.
create table if not exists public.credit_grants (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 source text not null default 'admin' check (source in ('admin','smartstore','promotion')),
 quantity integer not null check (quantity > 0),
 remaining integer not null check (remaining >= 0 and remaining <= quantity),
 expires_at timestamptz not null,
 reason text not null,
 note text,
 issued_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now()
);
create index if not exists credit_grants_spend_idx on public.credit_grants(user_id,expires_at,created_at) where remaining > 0;
create table if not exists public.credit_ledger (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 grant_id uuid references public.credit_grants(id) on delete set null,
 event_id uuid references public.events(id) on delete set null,
 action text not null check (action in ('grant','spend','revoke','expire','adjust')),
 amount integer not null check (amount <> 0),
 actor_id uuid references auth.users(id) on delete set null,
 reason text,
 idempotency_key text not null unique,
 created_at timestamptz not null default now()
);
create index if not exists credit_ledger_user_idx on public.credit_ledger(user_id,created_at desc);
create unique index if not exists credit_one_spend_per_event on public.credit_ledger(event_id) where action = 'spend';
create table if not exists public.credit_admin_audit (
 id uuid primary key default gen_random_uuid(),
 actor_id uuid references auth.users(id) on delete set null,
 target_user_id uuid not null references auth.users(id) on delete cascade,
 action text not null,
 grant_id uuid references public.credit_grants(id) on delete set null,
 quantity integer not null,
 reason text not null,
 created_at timestamptz not null default now()
);
alter table public.credit_grants enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.credit_admin_audit enable row level security;
-- No client policies: only verified service-role API and SECURITY DEFINER transactions.
revoke all on public.credit_grants,public.credit_ledger,public.credit_admin_audit from anon,authenticated;
grant select,insert,update on public.credit_grants to service_role;
grant select,insert on public.credit_ledger,public.credit_admin_audit to service_role;

create or replace function public.credit_issue_admin(
 p_user uuid,p_actor uuid,p_quantity integer,p_expires timestamptz,p_reason text,p_note text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_grant uuid;
begin
 if p_actor is null or p_quantity is null or p_quantity < 1 or p_quantity > 10000 or p_expires <= now()
    or length(trim(coalesce(p_reason,''))) < 2 then raise exception 'INVALID_CREDIT_GRANT'; end if;
 if not exists (select 1 from auth.users where id=p_user) then raise exception 'USER_NOT_FOUND'; end if;
 insert into public.credit_grants(user_id,quantity,remaining,expires_at,reason,note,issued_by)
 values(p_user,p_quantity,p_quantity,p_expires,p_reason,p_note,p_actor) returning id into v_grant;
 insert into public.credit_ledger(user_id,grant_id,action,amount,actor_id,reason,idempotency_key)
 values(p_user,v_grant,'grant',p_quantity,p_actor,p_reason,'admin-grant:'||v_grant);
 insert into public.credit_admin_audit(actor_id,target_user_id,action,grant_id,quantity,reason)
 values(p_actor,p_user,'grant',v_grant,p_quantity,p_reason);
 return v_grant;
end $$;

create or replace function public.credit_revoke_admin(
 p_grant uuid,p_actor uuid,p_quantity integer,p_reason text
) returns integer language plpgsql security definer set search_path = public as $$
declare v_grant public.credit_grants%rowtype;
begin
 if p_actor is null or p_quantity is null or p_quantity < 1 or length(trim(coalesce(p_reason,''))) < 2 then raise exception 'INVALID_REVOKE'; end if;
 select * into v_grant from public.credit_grants where id=p_grant for update;
 if not found or v_grant.remaining < p_quantity then raise exception 'INSUFFICIENT_UNUSED_CREDITS'; end if;
 update public.credit_grants set remaining=remaining-p_quantity where id=p_grant;
 insert into public.credit_ledger(user_id,grant_id,action,amount,actor_id,reason,idempotency_key)
 values(v_grant.user_id,p_grant,'revoke',-p_quantity,p_actor,p_reason,'admin-revoke:'||gen_random_uuid());
 insert into public.credit_admin_audit(actor_id,target_user_id,action,grant_id,quantity,reason)
 values(p_actor,v_grant.user_id,'revoke',p_grant,p_quantity,p_reason);
 return p_quantity;
end $$;

create or replace function public.credit_publish_invitation(
 p_user uuid,p_slug text,p_expected_updated_at timestamptz,p_event jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_event public.events%rowtype; v_grant public.credit_grants%rowtype; v_published timestamptz; v_updated timestamptz;
begin
 select * into v_event from public.events where slug=p_slug and owner_id=p_user for update;
 if not found then raise exception 'EVENT_NOT_FOUND'; end if;
 if v_event.status='published' then return jsonb_build_object('status','published','revision',v_event.updated_at); end if;
 if v_event.status not in ('draft','paid') then raise exception 'INVALID_PUBLISH_STATE'; end if;
 if v_event.published_at is not null then raise exception 'INVALID_PUBLISH_STATE'; end if;
 if v_event.updated_at is distinct from p_expected_updated_at then raise exception 'STALE_EVENT'; end if;
 -- Serialize spending for one member across simultaneous publication requests.
 perform pg_advisory_xact_lock(hashtextextended(p_user::text, 8675309));
 select * into v_grant from public.credit_grants
 where user_id=p_user and remaining>0 and expires_at>now()
 order by expires_at,created_at,id for update limit 1;
 if not found then raise exception 'NO_CREDITS'; end if;
 update public.credit_grants set remaining=remaining-1 where id=v_grant.id;
 v_published=now();
 update public.events set
 kind=coalesce((p_event->>'kind')::public.event_kind,kind),
 template_id=case when p_event ? 'template_id' then (p_event->>'template_id')::uuid else template_id end,
 template_version_id=case when p_event ? 'template_version_id' then (p_event->>'template_version_id')::uuid else template_version_id end,
 hero_preset_id=case when p_event ? 'hero_preset_id' then (p_event->>'hero_preset_id')::uuid else hero_preset_id end,
 title=coalesce(p_event->>'title',title),
 starts_at=case when p_event ? 'starts_at' then (p_event->>'starts_at')::timestamptz else starts_at end,
 settings=coalesce(p_event->'settings',settings),
 status='published',published_at=v_published,service_started_at=v_published,
 service_expires_at=case when p_event ? 'service_expires_at' then (p_event->>'service_expires_at')::timestamptz else service_expires_at end,
 grace_ends_at=case when p_event ? 'grace_ends_at' then (p_event->>'grace_ends_at')::timestamptz else grace_ends_at end
 where id=v_event.id returning updated_at into v_updated;
 insert into public.credit_ledger(user_id,grant_id,event_id,action,amount,reason,idempotency_key)
 values(p_user,v_grant.id,v_event.id,'spend',-1,'first publication','publish:'||v_event.id);
 return jsonb_build_object('status','published','revision',v_updated);
end $$;
revoke all on function public.credit_issue_admin(uuid,uuid,integer,timestamptz,text,text) from public,anon,authenticated;
revoke all on function public.credit_revoke_admin(uuid,uuid,integer,text) from public,anon,authenticated;
revoke all on function public.credit_publish_invitation(uuid,text,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.credit_issue_admin(uuid,uuid,integer,timestamptz,text,text) to service_role;
grant execute on function public.credit_revoke_admin(uuid,uuid,integer,text) to service_role;
grant execute on function public.credit_publish_invitation(uuid,text,timestamptz,jsonb) to service_role;
