-- Anonymous RSVP submissions are validated by the server API.
-- Keep direct browser inserts unavailable and grant only the server role.
revoke insert on table public.rsvps from anon, authenticated;
grant insert on table public.rsvps to service_role;