-- GAP ⑦-A: distinguish payment completion from final publication.

alter type public.event_status add value if not exists 'paid' before 'published';

alter table public.events
  add column if not exists paid_at timestamptz,
  add column if not exists service_started_at timestamptz;

-- Preserve the original service start for legacy published invitations when known.
update public.events
set service_started_at = published_at
where status = 'published'
  and service_started_at is null
  and published_at is not null;
