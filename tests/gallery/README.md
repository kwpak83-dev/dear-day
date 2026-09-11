# Gallery checks

These tests use a local PostgreSQL WASM engine and mock Storage; they never connect to a real Supabase project.

From the project root:

```powershell
pnpm --dir tests/gallery install
pnpm --dir tests/gallery test
```

The browser test expects Microsoft Edge and a Next development server on port 4318 with these **test-only** variables. Run this server in a separate terminal, not against real credentials:

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL='http://127.0.0.1:4319'
$env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='test-key'
$env:SUPABASE_SERVICE_ROLE_KEY='test-service-key'
pnpm dev -p 4318
```

Then run `pnpm --dir tests/gallery test:browser`. The test starts its own mock Supabase endpoint on port 4319, intercepts gallery mutations, and exercises the actual editor/public components in a mobile browser. Screenshots are written to `tests/gallery/screenshots/`. Use a fresh terminal after testing to avoid retaining the test environment variables.

The SQL check runs the real migrations, excluding only the initial `pgcrypto` extension declaration (the test engine already provides `gen_random_uuid`), and stubs the Supabase auth schema/roles. It does not replace deployment verification on hosted Supabase.
