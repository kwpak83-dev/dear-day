#!/usr/bin/env bash
set -euo pipefail
# Run only against the disposable PostgreSQL service in GitHub Actions.
if [[ "${PGHOST:-}" != "127.0.0.1" || "${PGDATABASE:-}" != "dear_day_ci" ]]; then
  echo "Refusing to run outside the isolated CI database" >&2
  exit 2
fi
owner="11111111-1111-4111-8111-111111111111"
event="44444444-4444-4444-8444-444444444444"
psql -X -v ON_ERROR_STOP=1 -c "insert into public.events(id,owner_id,status) values ('$event','$owner','draft')"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
# Session A holds the event row lock, then commits the deletion.
(
  psql -X -v ON_ERROR_STOP=1 >"$tmp/deletion.log" 2>&1 <<SQL
begin;
select id from public.events where id='$event' for update;
\echo EVENT_LOCKED
select pg_sleep(3);
delete from public.events where id='$event';
commit;
SQL
) &
pid=$!
for i in $(seq 1 80); do
  if grep -q EVENT_LOCKED "$tmp/deletion.log" 2>/dev/null; then break; fi
  if ! kill -0 "$pid" 2>/dev/null; then cat "$tmp/deletion.log"; exit 1; fi
  sleep 0.05
done
grep -q EVENT_LOCKED "$tmp/deletion.log" || { echo "Deletion lock not acquired"; exit 1; }
# Session B must wait for the event row lock, then fail after deletion.
if psql -X -v ON_ERROR_STOP=1 -c "select public.reserve_invitation_upload('$event','$owner','invitation-photos','$owner/race.jpg')" >"$tmp/reservation.log" 2>&1; then
  echo "FAIL: upload reservation succeeded after concurrent deletion" >&2
  exit 1
fi
wait "$pid"
grep -q 'Invitation unavailable for upload' "$tmp/reservation.log" || { cat "$tmp/reservation.log"; exit 1; }
count="$(psql -X -At -c "select count(*) from public.invitation_upload_reservations where event_id='$event'")"
[[ "$count" == "0" ]] || { echo "FAIL: orphaned reservation after deletion"; exit 1; }
echo "PASS: concurrent event deletion fences a late upload reservation"
