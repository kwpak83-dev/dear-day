# Customer Storage upload cutover

The PostgreSQL CI fixture applies retention migrations 001–019 in order with
minimal platform schemas. It does not validate Supabase Storage HTTP behavior.
Keep the upload guard and all physical cleanup disabled until the HTTP suite
passes against a disposable Supabase stack.

## Isolated verification

### Minimal Storage stack without Realtime

The CLI can exclude the running Realtime service, but CLI 2.95.4 still
uses its image while initializing the local database. The following
PowerShell commands instead start only PostgreSQL and Storage API. Use
a fresh fixture network and containers. The credentials below are
disposable and the API is bound to loopback.

```powershell
docker network create dearday-http-only
docker run -d --name supabase_db_dearday-storage-http --label com.supabase.cli.project=dearday-storage-http --network dearday-http-only --network-alias db -e POSTGRES_PASSWORD=dearday-disposable-local -e JWT_SECRET=dearday-isolated-storage-jwt-secret-only-2026 public.ecr.aws/supabase/postgres:17.6.1.106
docker inspect --format '{{.State.Health.Status}}' supabase_db_dearday-storage-http
# Wait for healthy before continuing.
docker exec -e PGPASSWORD=dearday-disposable-local supabase_db_dearday-storage-http psql -X -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -qc "alter role supabase_storage_admin password 'dearday-disposable-local'"
docker run -d --name supabase_storage_dearday-storage-http --label com.supabase.cli.project=dearday-storage-http --network dearday-http-only -p 127.0.0.1:55450:5000 -e DATABASE_URL=postgres://supabase_storage_admin:dearday-disposable-local@db:5432/postgres -e AUTH_JWT_SECRET=dearday-isolated-storage-jwt-secret-only-2026 -e STORAGE_BACKEND=file -e FILE_STORAGE_BACKEND_PATH=/var/lib/storage -e GLOBAL_S3_BUCKET=dearday-http -e TENANT_ID=dearday-http -e REGION=local -e FILE_SIZE_LIMIT=10485760 -e IS_MULTITENANT=false public.ecr.aws/supabase/storage-api:v1.54.1
Invoke-WebRequest http://127.0.0.1:55450/status
# Wait for HTTP 200 before applying migrations.
./scripts/apply-storage-http-fixture.ps1
```

Run both modes from the repository root. The runner generates a local
service JWT for Storage HTTP and uses the dedicated PostgreSQL container
for synthetic event creation and reservation RPC calls.

```powershell
$env:DEARDAY_TEST_STORAGE_URL = 'http://127.0.0.1:55450'
$db = 'supabase_db_dearday-storage-http'
if ((docker inspect --format '{{ index .Config.Labels "com.supabase.cli.project" }}' $db) -ne 'dearday-storage-http') { throw 'Wrong fixture container' }
node scripts/test-storage-http-local.mjs --standalone
if ($LASTEXITCODE -ne 0) { throw 'Guard-off test failed' }
docker exec $db psql -X -U postgres -v ON_ERROR_STOP=1 -qc 'update public.invitation_storage_write_gate set require_reservation=true'
if ($LASTEXITCODE -ne 0) { throw 'Failed to enable isolated test gate' }
try {
  node scripts/test-storage-http-local.mjs --standalone --guard-on
  if ($LASTEXITCODE -ne 0) { throw 'Guard-on test failed' }
} finally {
  docker exec $db psql -X -U postgres -v ON_ERROR_STOP=1 -qc 'update public.invitation_storage_write_gate set require_reservation=false'
  if ($LASTEXITCODE -ne 0) { throw 'Failed to restore isolated test gate' }
  Remove-Item Env:DEARDAY_TEST_STORAGE_URL
}
```

Standalone checks compare downloaded bytes and listing metadata with
the file backend checksum. Rejected or interrupted objects must leave
neither listing entries nor backend files at the synthetic path. This
does not certify hosted policies, other Storage versions, or the S3
backend. GitHub CI still runs PostgreSQL fixtures separately.

With the guard restored to OFF, run
`node scripts/test-storage-http-local.mjs --standalone --deletion-fixture`
using the same loopback URL. This scenario creates two synthetic invitations,
checks that an outdated due date blocks DB deletion, then verifies that the
existing finalization RPC deletes the expired invitation and leaves a durable
cleanup ledger. It deletes only the newly created exclusive fixture object by
HTTP and verifies that the second invitation's shared file remains. It also
exercises a claim under the job and object locks, duplicate claim rejection,
and a second HTTP deletion after simulating loss of the first successful
response. A stale attempt cannot mark the newer attempt complete.

Those queue transitions are confined to the synthetic fixture. The production
cleanup endpoint still reports candidates without deleting files.
`scopedUnreferenced` is a review count for completed event-scoped notice
uploads that had no reference found by inspection. It cannot authorize a
physical removal.

### Run the guard-off HTTP smoke test on Windows

Use Docker Desktop in Linux-container mode and a dedicated CLI project.
Run these commands from the repository root in PowerShell. The fixture uses
the default local API port, so stop any conflicting local Supabase stack first.
The first command is only needed if the Docker CLI is not already on PATH.

```powershell
$env:Path = "$env:LOCALAPPDATA/Programs/DockerDesktop/resources/bin;$env:Path"
$testProject = Join-Path (Get-Location) 'node_modules/.dearday-storage-http'
New-Item -ItemType Directory -Force $testProject | Out-Null
Push-Location $testProject
npx.cmd --yes supabase@2.95.4 init
npx.cmd --yes supabase@2.95.4 start -x studio,imgproxy,mailpit,realtime,edge-runtime,logflare,vector,supavisor,postgres-meta
if ($LASTEXITCODE -ne 0) { throw 'Isolated Supabase startup failed' }
$local = npx.cmd --yes supabase@2.95.4 status -o json | ConvertFrom-Json
Pop-Location
./scripts/apply-storage-http-fixture.ps1
$env:DEARDAY_TEST_STORAGE_URL = $local.API_URL.Replace('localhost', '127.0.0.1')
$env:DEARDAY_TEST_STORAGE_SERVICE_KEY = $local.SERVICE_ROLE_KEY
try { node scripts/test-storage-http-local.mjs }
finally { Remove-Item Env:DEARDAY_TEST_STORAGE_URL, Env:DEARDAY_TEST_STORAGE_SERVICE_KEY }
```

Apply the fixture only once per fresh test database. It takes the ordered
prerequisites and migrations 001–019 from the CI fixture without importing
its mock platform schemas or the duplicate historical migration versions.
The HTTP smoke test can be repeated on that database with unique synthetic
users and paths. It preserves fixtures for inspection. When finished, run
`npx.cmd --yes supabase@2.95.4 stop` inside the dedicated test directory.

The smoke test keeps the write gate off. It checks reserved and direct
uploads, a signed upload, rejection of a duplicate with upsert disabled,
and a simulated lost response after the server accepted an upload.
Its byte check uses the download API and listing metadata. The guard-on
variant is available as `node scripts/test-storage-http-local.mjs --guard-on`
after switching the dedicated fixture database gate on. Restore the gate to
false in a `finally` block and keep the test credentials scoped to that
terminal. A backend-level orphan scan remains a separate check.

Use a fresh local Supabase stack with synthetic users, private test credentials
and a disposable object backend. Do not link the project or load production
environment files. Apply the prerequisite schema and retention migrations in
order. Test the compatibility state before any separately approved isolated
guard-on run.

For each case record the HTTP outcome, metadata row count, reservation status,
and checksum of the downloaded bytes or confirmation of absence in the object
backend. Check the backend directly for orphan bytes even if the Storage API
returns not found.

| Case | Required guard-on result |
| --- | --- |
| Reserved upload | Correct bytes and metadata, one reservation |
| Direct and signed uploads without reservation | No visible object or orphan bytes |
| Signed upload with reservation | Verify authorization, one object and correct bytes |
| Completed reservation replay and overwrite | Original checksum and metadata preserved |
| Upload interruption and lost response | Reconcile the uncertain outcome without releasing the cleanup blocker |
| Upload racing a fenced object | Rejected write and no orphan bytes |

Only add a required HTTP CI check once the isolated stack can be provisioned
reproducibly. Use loopback-only endpoints and synthetic credentials. Keep the
PostgreSQL metadata test separate.

## Rollout and rollback

1. Verify legacy readers and uploads with the guard off. Apply migrations only
   under separate approval. Verify the reservation RPC and first-upload draft
   flow in the target environment.
2. Coordinate the server reservation flag and the public build-time editor
   flag. Refresh or retire older editor builds before enforcing the gate.
   Monitor reservation failures, stuck reservations and gallery begin/finish.
3. Verify direct and signed Storage writes, object backend consistency and
   reservation ownership against the hosted API version. Do not enforce the
   gate until these checks pass.
4. If enforcement must be rolled back, disable the database gate first and
   then roll back the client/server flags together. Keep the object registry,
   reservations and references. Physical cleanup stays disabled.

Public template assets and customer-owned paths must be classified by resolved
bucket and path. In particular, resolve BGM track IDs, HERO preset and template
asset IDs, and check older URL forms against the customer buckets before
declaring the reference inventory complete.
