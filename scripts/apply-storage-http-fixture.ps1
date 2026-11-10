$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$container = 'supabase_db_dearday-storage-http'
$project = docker inspect --format '{{ index .Config.Labels "com.supabase.cli.project" }}' $container
if ($LASTEXITCODE -ne 0 -or $project -ne 'dearday-storage-http') {
    throw 'Expected the dedicated dearday-storage-http test container.'
}
$ready = docker exec $container psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -Atc "select to_regclass('storage.objects') is not null and to_regclass('public.events') is null"
if ($LASTEXITCODE -ne 0 -or $ready -ne 't') { throw 'Start a fresh isolated stack with Storage before applying the fixture.' }
$fixture = Join-Path $repo 'tests/sql/retention-migration-order-smoke.sql'
foreach ($line in Get-Content -LiteralPath $fixture) {
    if ($line -notmatch '^\\ir ../../(supabase/migrations/[^\s]+)$') { continue }
    $migration = Join-Path $repo $Matches[1]
    Get-Content -Raw -LiteralPath $migration | docker exec -i $container psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -q
    if ($LASTEXITCODE -ne 0) { throw "Failed isolated migration: $migration" }
}
$gate = docker exec $container psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -Atc 'select require_reservation from public.invitation_storage_write_gate where singleton'
if ($LASTEXITCODE -ne 0 -or $gate -ne 'f') { throw 'The fixture must keep the upload guard off.' }
docker exec $container psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -qc "notify pgrst, 'reload schema'"
if ($LASTEXITCODE -ne 0) { throw 'Failed to refresh the isolated API schema.' }
