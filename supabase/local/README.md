# Local test copy of Supabase

For checking `supabase/setup.sql` and the app's account code without touching the real project. Needs Docker.

```sh
cd supabase/local
# Make a .env with JWT_SECRET, ANON_KEY and SERVICE_ROLE_KEY (HS256 JWTs signed with JWT_SECRET,
# roles "anon" and "service_role"), then:
docker compose -p cu up -d
PGPASSWORD=pw psql -h localhost -p 54322 -U postgres -f ../setup.sql
node proxy.js &            # the API on http://localhost:54321
```

Then from the repo root:

```sh
# Database rules (10 checks)
SUPABASE_TEST_URL=http://localhost:54321 SUPABASE_TEST_KEY=<ANON_KEY> node --test tests/server.test.js

# The app in a browser, 3 simulated phones (needs Playwright)
python3 -m http.server 8000 &
SUPABASE_TEST_KEY=<ANON_KEY> PHOTO=/path/to/any.jpg node supabase/local/browser-test.js
```

`roles.sql` and `jwt.sql` come from Supabase's [self-hosting files](https://github.com/supabase/supabase/tree/master/docker/volumes/db). This is a cut-down stack (database, auth, API and storage only), so it doesn't prove every hosted Supabase setting behaves the same way.
