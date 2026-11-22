# Mini-LMS: consultation booking

A take-home for Contour's Software Engineer role. Students sign up, book one-to-one consultations, and reschedule, cancel or mark them complete. Admins see every consultation, read-only.

Stack: Next.js 16.4.6 (App Router, TypeScript), Supabase (Auth, Postgres, local CLI on Docker), `@supabase/ssr`, shadcn/ui, zod, Vitest.

The full design, including the options I rejected, is in [`docs/superpowers/specs/2026-11-22-mini-lms-design.md`](docs/superpowers/specs/2026-11-22-mini-lms-design.md).

## 1. Setup

### Prerequisites

- Node.js 20.12 or later (the seed script uses `process.loadEnvFile`; developed on Node 25)
- Docker, running (the Supabase CLI starts its containers there)
- The Supabase CLI is a dev dependency, so `npx supabase` works after `npm ci`

### Commands

```bash
npm ci
npx supabase start            # first run pulls the Docker images
cp .env.example .env.local
npx supabase status -o env    # prints the values for .env.local
```

Fill in `.env.local` from the `supabase status -o env` output:

| `.env.local` variable | Value from `supabase status -o env` | Used by |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `API_URL` (`http://127.0.0.1:54321`) | browser and server |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `PUBLISHABLE_KEY` (`sb_publishable_...`) | browser and server |
| `SUPABASE_SECRET_KEY` | `SECRET_KEY` (`sb_secret_...`) | server only |
| `SUPABASE_DB_URL` | `DB_URL` (already filled in `.env.example`) | integration tests only |

The plain `npx supabase status` output shows the same keys as "Publishable" and "Secret". If an older CLI prints only the legacy `anon` and `service_role` JWTs, put those in the same two variables.

Then load the schema and demo data, and start the app:

```bash
npm run db:reset              # supabase db reset (migrations) + seed
npm run dev                   # http://localhost:3000
```

### Demo accounts

All demo accounts use the password `Password123!`.

| Email | Role |
|---|---|
| `admin@demo.local` | admin |
| `alice@demo.local` | student |
| `bob@demo.local` | student |

The seed gives Alice a booking in every state (upcoming and past `scheduled`, `completed`, `cancelled`) and Bob a smaller mix. One of Alice's cancelled bookings shares a slot with an active one, which the partial unique index allows. Times are relative to when you seed, so the upcoming ones start inside the booking window. Re-run `npm run db:seed` if the data gets stale.

- `npm run db:seed` deletes and recreates only the demo users and their bookings. The schema is untouched.
- `npm run db:reset` wipes the database, reapplies the migrations and seeds again.

You can also sign up with any email. Email confirmation is off locally, so a new account goes straight in as a student.

### Other scripts

```bash
npm test             # unit + integration tests (needs `supabase start` and .env.local)
npm run test:unit    # unit tests only, no database needed
npm run test:int     # integration tests only
npm run lint
npm run typecheck
npm run build
npm run db:types     # regenerate lib/supabase/database.types.ts from the local schema
```

`npm test` runs 126 tests: Vitest unit tests, plus integration tests against the local Supabase instance covering the schema, the direct-API lockdown, the guards, the service and the route handlers. The integration tests mock only the session module (`lib/auth/session.ts`), so they choose who is signed in. Everything else runs for real: role lookup, the service, Postgres constraints and the route handlers.

## 2. Implementation summary

### Features

- Sign up, log in and log out with Supabase Auth (from the `with-supabase` template).
- `/dashboard` (student): your consultations, grouped by display state: Needs your update, Upcoming and History. Each row has a Mark complete or Mark incomplete button, a Reschedule dialog and a Cancel dialog with confirmation. Cancelled rows are muted, have no actions and sit behind "Show cancelled (n)" in History. A "Book a consultation" button opens the booking dialog.
- Booking dialog (student): first name, last name, reason and a day plus a grid of 15-minute slots. The slots are limited to the booking window. The reschedule dialog is the same component in a second mode. `/consultations/new` redirects to `/dashboard?book=1`, which opens the dialog.
- `/admin` (admin): read-only table of all consultations, including cancelled ones, with the student's name, the account email and a display-state badge. Keyset paginated, 20 per page, with First page and Next page buttons. There is no total count, because keyset pagination doesn't produce one cheaply.
- `/` redirects by role: admins to `/admin`, students to `/dashboard`. A user with no role row goes to `/no-access`.

### UI decisions

The full list is in `docs/superpowers/specs/2026-11-22-ui-ux-refresh.md`.

- D1: a past `scheduled` booking can still be cancelled, as the API allows. In the UI its main actions are Mark complete and Reschedule, and Cancel is in the ⋯ menu.
- D2: the dashboard groups by display state (Needs your update, Upcoming, History), not by date alone.
- D3: booking opens in a dialog from the dashboard. The old `/consultations/new` link redirects to `/dashboard?book=1`.
- D4: there is no per-student booking cap, in the UI or the API.
- D5: times show in the browser's time zone, with an explicit label such as "Times in Adelaide time (ACDT)".
- D6: booking and rescheduling share one dialog component with two modes.

### Architecture

```
Browser (React, shadcn/ui)
  │  fetch('/api/...')            only data path from the browser (lib/api/client.ts)
  │  supabase.auth.*              only direct Supabase call (login, sign-up, logout)
  ▼
proxy.ts                          refreshes the session cookie, redirects signed-out
                                  users to /auth/login. Never queries the database.
  ▼
Route handlers  app/api/**        handle(): origin check, guard, zod, error mapping
Pages           app/(student|admin)/**   requireRolePage() on every page
  ▼
lib/auth/guards.ts                requireUser / requireRole (throw 401/403)
                                  requireRolePage (redirects)
lib/auth/roles.ts                 getRole(userId): the only place that reads user_roles
  ▼
lib/consultations/service.ts      all business rules, every query scoped by userId
  ▼
lib/supabase/admin.ts             privileged client, 'server-only', SUPABASE_SECRET_KEY
  ▼
Postgres                          RLS on with no policies; integrity constraints only
```

### Where each kind of rule lives

| Kind of rule | Example | Lives in |
|---|---|---|
| Permission: who | owner-only changes, admin-only list | TypeScript: `lib/auth/guards.ts` and the service |
| Business: when and which transition | 24 hours to 14 days ahead, starts 8:00 am to 7:45 pm Melbourne time, cancelled is final | TypeScript: `lib/consultations/service.ts` and `rules.ts` |
| Data integrity: what is valid data | status enum, 15-minute alignment, one active booking per slot | Postgres constraints |

### API

All routes return JSON. Errors are `{ "error": { "code", "message" } }`.

| Method and path | Role | Action |
|---|---|---|
| `GET /api/consultations` | student | list own, ordered by `scheduled_at` |
| `POST /api/consultations` | student | book `{ firstName, lastName, reason, scheduledAt }` |
| `PATCH /api/consultations/[id]` | student | exactly one of `{ scheduledAt }` (reschedule) or `{ completed: boolean }` (toggle) |
| `POST /api/consultations/[id]/cancel` | student | cancel |
| `GET /api/admin/consultations?cursor=&limit=` | admin | list all with account email; keyset paginated by `(scheduled_at, id)`, `limit` 1 to 100, default 20 |

| Status | When |
|---|---|
| 400 | validation failed (body, id, limit or cursor) |
| 401 | not signed in |
| 403 | wrong role, or failed the origin / content-type check |
| 404 | not found, or not yours |
| 409 | slot already booked, or the status change isn't allowed |

### Status changes

```
scheduled ──complete──▶ completed
    ▲   ◀──incomplete──     │
    │                       ✗ no reschedule, no cancel
 reschedule (scheduled only)
    │
    └──cancel──▶ cancelled   (final)
```

Each change is one conditional `UPDATE ... WHERE id = $1 AND user_id = $2 AND status = <from>`. If no row changes, the service reads the row once to choose between 404 (missing or not yours) and 409 (wrong status). Marking an already-completed booking complete again returns it unchanged, so the toggle is idempotent.

## 3. Justifications

### RBAC in TypeScript instead of RLS policies

The brief allows RBAC without RLS if justified. I compared four options (spec §5):

- Postgres functions for every action: one choke point, but the logic sits in PL/pgSQL, split across two languages and harder to test.
- Student writes under RLS plus column grants: standard Supabase style, but a student can call the auto-generated REST API directly and skip business rules on their own rows.
- RLS for reads, a service for writes: permission rules end up in both SQL policies and TypeScript.
- Chosen: all data access goes through one server-side TypeScript service using the secret key, and RLS is on with no policies.

Every permission and business rule is in one language and one layer. It's easy to read and test, and adding a role means changing a map in code, not adding policies table by table.

The risk is that the secret key bypasses RLS, so a bug in the service could leak data. To contain that:

- Only app code in `lib/supabase/admin.ts` creates the privileged client, and it imports `server-only`, so a client bundle that pulls it in fails to build. The seed script and the test helpers build their own clients, outside the app.
- Every service method takes the verified `userId` and scopes every query by it.
- Tests check that student B gets 404 on student A's booking and that a student gets 403 from the admin route.

### RLS on with no policies, as a lock

With RLS enabled and no policies, the publishable key and user JWTs can't read or write any table through the Supabase REST API. The migration also revokes all table privileges from `anon` and `authenticated`. `tests/integration/lockdown.test.ts` calls the REST API directly with the publishable key, both signed out and signed in as a student. Reads of all three tables, a direct insert and a self-promotion to admin all fail with `42501` (permission denied), and the role in the database stays `student`.

### Performance

There's no meaningful difference from RLS. The ownership filter is the same indexed `WHERE user_id = ...` either way, and there's no per-row policy function call. The cost is one primary-key lookup on `user_roles` and one JWT verification per request. `getRole` and `getVerifiedUserId` are wrapped in React `cache()`, so a page render does each lookup once however many components ask. Route handlers make each lookup once through their guard. Indexes:

- `(user_id, scheduled_at)` for the student list
- `(scheduled_at, id)` for the admin keyset pagination
- a partial unique index `(user_id, scheduled_at) WHERE status <> 'cancelled'`

Keyset pagination stays fast at any depth, unlike `OFFSET`.

### Pages call the service directly (this isn't a Server Action)

Server components call the service functions directly after the same guard, instead of fetching their own API over HTTP. Next.js recommends this, because a request back to your own API adds latency and repeats authentication. The permission checks are the same on both paths. Every mutation goes through the API routes. The codebase has no Server Actions.

### Role routing in pages, not in the proxy

`proxy.ts` only refreshes the session and redirects signed-out users away from pages. `/api/*` is not redirected: the route handlers return their own 401 JSON, and `apiFetch` also rejects any redirected or non-JSON success response. It never touches the database, so role decisions all go through `getRole` and the guards.

Every page calls `requireRolePage(role)` itself. The route-group layouts (`app/(student)/layout.tsx`, `app/(admin)/layout.tsx`) also call it through `RoleShell`, but that is only a UX redirect, not the security boundary. The reason is `cacheComponents`:

- The template enabled `cacheComponents`. With it on, page segments were prerendered into static RSC payloads, and those could be fetched without the layout guard running.
- Every route here is per-user and dynamic, so there is nothing to cache. I turned `cacheComponents` off and put the guard in each page, so a page can't render data unless its own guard passed.

### `handle()` rethrows Next.js control-flow errors

`lib/api/http.ts` wraps every route handler. Its catch block calls `unstable_rethrow(e)` first, so `redirect()` and `notFound()` aren't turned into 500s. Then it maps `ApiError` and `ZodError` to their status codes, and anything else to a generic 500.

### Soft cancel

Cancel sets `status = 'cancelled'` and never deletes the row. Admins keep the history, and the partial unique index frees the slot for a new booking.

### 404, not 403, for someone else's booking

Every student query includes `user_id = <verified user>`, so another student's booking comes back as not found. Returning 404 doesn't reveal that the id exists.

### Hardened sign-up trigger

`private.handle_new_user()` creates the `profiles` and `user_roles` rows on sign-up:

- It lives in a `private` schema, which the Supabase API doesn't expose.
- It's `security definer` with `set search_path = ''` and fully qualified names, so it can't be hijacked through the search path.
- `EXECUTE` is revoked from `public`, `anon` and `authenticated`.
- The role defaults to `student`. Nothing a user sends at sign-up can choose it.

### Booking window and business hours

- At least 24 hours ahead: a later triage step (out of scope) needs time to assign a consultant.
- At most 14 days ahead: high-school students rarely plan further out, and it caps how many future bookings one student can hold.
- Both limits are rolling from now, not calendar days, so no time zone has to decide when "tomorrow" starts.
- Consultations start between 8:00 am and 7:45 pm **Melbourne time** (`Australia/Melbourne`), on the quarter hour. The brief sets no hours, but a 1:30 am consultation can't be staffed. Contour is Melbourne-based, so the hours are pinned to that zone and daylight saving is handled by `Intl`. The picker shows the same hours converted to the student's local time, with a one-line note saying so.
- The values are constants in `lib/consultations/rules.ts` (`MIN_LEAD_HOURS`, `MAX_AHEAD_DAYS`, `SLOT_MINUTES`, `BUSINESS_TIME_ZONE`, `OPEN_HOUR`, `CLOSE_HOUR`). The service enforces them, and the `SlotPicker` (used by the booking and reschedule dialog) only offers slots that pass (both use the same `availableSlots` and `isWithinBusinessHours`), so a change is one line.
- Validation messages are written for students ("First name is required", "Choose a day and time"), set in the shared zod schema that both the form and the API use.

## 4. Assumptions

- A consultation is a one-to-one slot a student books for help. Assigning a consultant and setting a duration happen in a later step that isn't built. `scheduled_at` is the student's preferred time.
- "Complete" is the student's own tracking. It can be set at any time, even before the scheduled time, and toggling it doesn't re-check the booking window.
- A past `scheduled` booking can still be cancelled. Status rules don't depend on time.
- The dashboard groups by display state. A past `scheduled` booking shows as "Past, not marked" under Needs your update, and a past `completed` one is in History. Display state comes from the status and the time against now.
- First and last name are stored on each consultation because the brief puts them on the form. The account email is in `profiles`, so the admin can see who booked even if the typed names differ.
- Admins are staff accounts. They don't book, and they can't change anything. Each user has one role.
- Times are stored as `timestamptz` (UTC). The client sends ISO 8601 with an offset, and the UI shows the browser's local time.
- Slots must start on a 15-minute boundary. The API rejects anything else rather than rounding.
- Email confirmation is off in `supabase/config.toml`, so local sign-up logs you straight in.
- Out of scope: consultants, subjects, durations, availability calendars, overlap checks across people, notifications, a per-student booking limit and a hosted deployment.

## 5. Schema and migrations

There are two migrations, applied in order by `npm run db:reset`:

- [`20261122075056_init.sql`](supabase/migrations/20261122075056_init.sql): enums, tables, constraints, triggers, RLS and grants.
- [`20261122084321_lock_function_defaults.sql`](supabase/migrations/20261122084321_lock_function_defaults.sql): revokes the global `PUBLIC` EXECUTE default on functions (see §6). Types are generated into `lib/supabase/database.types.ts`.

| Table | Columns | Notes |
|---|---|---|
| `profiles` | `user_id` (PK, FK `auth.users`, cascade), `email`, `created_at` | Email copied at sign-up so the admin list can show it |
| `user_roles` | `user_id` (PK, FK `auth.users`, cascade), `role app_role` default `student`, `created_at` | One role per user |
| `consultations` | `id` uuid PK, `user_id` (FK `profiles`, cascade), `first_name`, `last_name`, `reason`, `scheduled_at timestamptz`, `status consultation_status` default `scheduled`, `created_at`, `updated_at` | Bookings |

Enums: `app_role` (`student`, `admin`) and `consultation_status` (`scheduled`, `completed`, `cancelled`).

Constraints on `consultations`:

- Names are 1 to 100 characters after trimming, and the reason is 1 to 1000.
- `extract(epoch from scheduled_at) % 900 = 0`: exact 15-minute alignment. Using the epoch avoids a cast that could round fractional seconds into a pass, and it doesn't depend on the session time zone.
- The partial unique index `(user_id, scheduled_at) WHERE status <> 'cancelled'` allows one active booking per student per slot. A completed booking still holds its slot. The service maps the resulting `23505` error to 409.

`consultations.user_id` references `profiles` rather than `auth.users`, so the admin query can embed the email with PostgREST (`select('..., profiles(email)')`).

Triggers (plumbing only, no business logic): `private.touch_updated_at()` on `consultations`, and `private.handle_new_user()` on `auth.users` (see above).

Seeding uses `scripts/seed.ts` and the Supabase admin API, not SQL inserts into `auth.users`. Hand-written `auth.users` rows depend on GoTrue internals and break when the auth service changes. `supabase/seed.sql` isn't used.

Growth path: for several roles per user, change the `user_roles` key to `(user_id, role)`. For fine-grained permissions, add `role_permissions (role, permission)` and replace `requireRole` with `requirePermission`. Callers don't change.

## 6. Security notes

The service holds a key that bypasses RLS, so the code follows these rules:

1. No user input in PostgREST filter strings: queries use the parameterised builders (`.eq()`, `.order()`, `.limit()`). `.or()` appears once, in the admin keyset cursor in `listAll`. The cursor is base64url JSON, decoded and validated with zod as an ISO datetime and a UUID. The service then re-serialises the timestamp with `Date#toISOString()` before putting both values into the filter, so no raw request text reaches the string.
2. No mass assignment: request schemas are `.strict()`, so unknown keys get 400. The service writes each column by name, and `user_id` always comes from the verified session. A body containing `userId` is rejected.
3. Route ids are validated as UUIDs before any query runs (400 otherwise).
4. No raw database errors reach the client: `23505` becomes 409. Anything unknown is logged on the server and returned as a generic 500 `{ code: 'internal', message: 'Something went wrong' }`. `handle()` forces that message for every `ApiError` with status 500 or above.
5. The session is verified: the server reads the user with `getClaims()`, which verifies the JWT, never with `getSession()`. A user id sent by the client is never trusted.
6. Missing role fails closed: a user with no `user_roles` row gets 403 from every API route and is redirected to `/no-access`.
7. Page size is capped: `limit` defaults to 20 and must be 1 to 100.
8. CSRF: Supabase auth cookies are `SameSite=Lax`. On top of that, every POST and PATCH must send a `Content-Type` starting with `application/json` and an `Origin` that matches the request's own origin, or it gets 403. This check runs before authentication, which the tests confirm.
9. Security headers (`next.config.ts`) on every response:
   - a Content-Security-Policy with `default-src 'self'`, `connect-src` limited to the app and the Supabase URL, `frame-ancestors 'none'`, `base-uri 'self'` and `form-action 'self'`
   - `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` and `Referrer-Policy: strict-origin-when-cross-origin`

   `@supabase/ssr` session cookies are readable by JavaScript, so limiting XSS protects the session. React escapes user text, and the code never uses `dangerouslySetInnerHTML`. The CSP still allows `'unsafe-inline'` scripts, which Next.js needs without a nonce setup.
10. The seed script only runs locally: it deletes users with the secret key, so `scripts/local-guard.ts` aborts unless the URL host is `localhost` or `127.0.0.1`. A unit test covers this.
11. Secrets stay out of git: `.env*.local` is ignored, and `.env.example` holds placeholders only.
12. No open redirect after email confirmation: `app/auth/confirm` passes its `next` parameter through `safeNextPath` (`lib/auth/safe-redirect.ts`). It accepts only a same-site path. It rejects absolute URLs, `//host`, backslashes and control characters, because browsers strip tab and newline, which turns `/%09/evil.com` into `//evil.com`. Anything else falls back to `/`. A unit test covers each bypass.

Grants are locked by default for objects created by `postgres` (what migrations run as). Besides revoking privileges on the three tables, the init migration runs `alter default privileges ... in schema public revoke all` for tables and sequences. A second migration (`lock_function_defaults`) also revokes the global `PUBLIC` EXECUTE default on functions, because a revoke scoped to one schema doesn't remove it. `tests/integration/schema.test.ts` checks that every table in `public` has RLS enabled, and creates a throwaway function and table in a rolled-back transaction to prove `anon` and `authenticated` get no access to them. Defaults that the platform's own `supabase_admin` role sets in `public` are outside the migrations' control, so objects created by that role (for example by Supabase extensions) may still be granted to the API roles. Review those separately.

Signed-out API calls get 401 JSON, not a redirect to the login page. Pages still redirect.

Booking spam: there is no per-student limit. The unique slot rule and the 14-day window cap one student at about 650 active future bookings (13 days of 48 open slots). Rate limiting is the right fix (see "With more time").

Roles take effect immediately. The role is read from the database on every request, so demoting an admin works at once. A role stored in a JWT claim would stay stale until the token refreshes.

Known minor gaps:

- The Content-Type check is a prefix match (`application/json...`), not an exact media-type parse.
- `listAll` trusts its typed cursor argument. Both callers validate it first, but the service doesn't re-validate (defence in depth).
- There is no rate limiting on the API routes.
- `profiles.email` isn't updated if a user changes their email.

## 7. In production

- Give team members Supabase read-only roles on the production project.
- Deploy migrations only from CI (`supabase db push` through the GitHub integration or branching), never through Studio or `psql`.
- Run a scheduled drift check (`supabase db diff --linked`) that fails if the live schema differs from the migrations.
- Turn email confirmation on, and keep Supabase Auth's built-in rate limits on login and sign-up.
- Keep `SUPABASE_SECRET_KEY` in the host's secret store, server-side only.
- Add `Strict-Transport-Security` (HSTS) and `Permissions-Policy` headers. They're left out locally because HSTS only makes sense over HTTPS.
- Behind a reverse proxy, configure the allowed origin for the Origin check. It compares against the request URL's own origin, which the proxy may rewrite.
- With email confirmation on, sign-up returns no session. The sign-up form currently assumes one, so it needs a "check your email" step.

## 8. With more time

Nothing in the planned scope was cut. Admin pagination is built. Next steps:

- Pagination for the student's own list (it currently returns all their bookings).
- Put the role in the JWT with a custom access token hook, to drop the per-request role lookup (and accept the staleness trade-off).
- Add RLS read policies back as a second layer of protection under the service, with pgTAP tests for them.
- Keep `profiles.email` in sync when a user changes their email.
- API rate limiting (for example Upstash).
- An exclusion constraint against overlapping bookings once durations exist.
- A consultant role with `consultant_id`, and consultant-side rescheduling.
- Separate attendance (did it happen) from the student's own "completed" flag and feedback.
- An exact `application/json` media-type check, and cursor re-validation inside `listAll`.
- Move keyboard focus to a sensible element after a successful cancel or reschedule. Focus returns to the opener when a cancel dialog closes without cancelling, but after a successful change the row moves and focus falls to the page.
- End-to-end browser tests. The UI was checked over HTTP with real sessions (role redirects, API flows, headers), not in a real browser.
- A hosted deployment.
