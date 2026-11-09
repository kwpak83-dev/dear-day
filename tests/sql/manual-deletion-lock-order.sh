#!/usr/bin/env bash
set -euo pipefail
[[ "${PGHOST:-}" == "127.0.0.1" && "${PGDATABASE:-}" == "dear_day_ci" ]] || exit 2
owner="11111111-1111-4111-8111-111111111111"
event="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
psql -X -v ON_ERROR_STOP=1 <<SQL
insert into public.events(id,owner_id,status) values('$event','$owner','draft');
insert into public.invitation_deletion_jobs(event_id,owner_id,due_at)
values('$event','$owner',clock_timestamp()+interval '1 day');
SQL
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
(
psql -X -v ON_ERROR_STOP=1 >"$tmp/holder.log" 2>&1 <<SQL
begin;
select id from public.invitation_deletion_jobs where event_id='$event' for update;
\\echo JOB_LOCKED
select pg_sleep(5);
rollback;
SQL
) &
holder=$!
for i in $(seq 1 100); do
  grep -q JOB_LOCKED "$tmp/holder.log" 2>/dev/null && break
  sleep 0.05
done
grep -q JOB_LOCKED "$tmp/holder.log" || { cat "$tmp/holder.log"; exit 1; }
(
psql -X -v ON_ERROR_STOP=1 >"$tmp/manual.log" 2>&1 <<SQL
set application_name='dear_day_manual_lock_test';
set lock_timeout='12s';
select public.delete_invitation_with_cleanup(
'$event','$owner',
(select updated_at from public.events where id='$event'),'[]'::jsonb);
SQL
) &
manual=$!
# Wait until manual deletion is blocked on the job lock.
blocked=0
for i in $(seq 1 80); do
  n="$(psql -X -At -c "select count(*) from pg_stat_activity where application_name='dear_day_manual_lock_test' and wait_event_type='Lock'")"
  if [[ "$n" == "1" ]]; then blocked=1; break; fi
  sleep 0.05
done
if [[ "$blocked" != "1" ]]; then
  cat "$tmp/manual.log"
  echo "Manual deletion never blocked on the job lock" >&2
  exit 1
fi
# If manual deletion locked event before job, NOWAIT would fail here.
psql -X -v ON_ERROR_STOP=1 -c "begin; select id from public.events where id='$event' for update nowait; rollback;" >"$tmp/event.log" 2>&1 || {
  cat "$tmp/event.log"; echo "FAIL: manual deletion locked event before job" >&2; exit 1;
}
wait "$holder"
wait "$manual"
[[ "$(psql -X -At -c "select count(*) from public.events where id='$event'")" == "0" ]]
echo "PASS: manual deletion waits on job before acquiring event lock"
