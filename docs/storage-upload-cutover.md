# Customer Storage upload cutover

The PostgreSQL CI fixture applies retention migrations 001–019 in order with
minimal platform schemas. It does not validate Supabase Storage HTTP behavior.
Keep the upload guard and all physical cleanup disabled until the HTTP suite
passes against a disposable Supabase stack.

## Isolated verification

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
