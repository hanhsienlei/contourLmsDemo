# Mini-LMS (Contour take-home): Design

Date: 2026-11-22
Source brief: `requirement.txt` (project root; it's the recruiter's email, so it is git-ignored and not submitted)

## 1. Intent

A take-home for Contour's Software Engineer role. The deadline is 48 hours after the email, and the build budget is **5 hours**. It is a small LMS where students book and manage consultations and admins see every consultation, read-only.

Reviewers grade:
- how it's built
- how well it scales
- industry best practice
- security
- whether the choices are consistent

The UI barely counts. The design aims to be small, consistent and easy to defend in the interview: one clear place for each kind of rule.

## 2. Goals, non-goals, anti-goals

**Goals**
- Sign up, log in and log out (Supabase Auth, via the `with-supabase` template).
- A student dashboard listing *their own* consultations, with a complete/incomplete toggle on each.
- A booking form with first name, last name, reason and date/time.
- Students can reschedule and cancel their own consultations.
- An admin view listing *all* consultations, read-only.
- A README covering setup, assumptions and justifications, an implementation summary, migrations and the schema.
- Seeded demo data, plus scripts to reset and refresh it.

**Non-goals (written in the README as assumptions or future work)**
- Teachers, consultants or staff assignment. No `teacher_id` or `consultant_id`.
- Subject or category, duration, availability calendars, overlap checks between people.
- A limit on active bookings per student (considered and dropped).
- Admins writing anything, or admins booking.
- Email notifications. A hosted deployment (local Docker only).

**Anti-goals (failure even if it "works")**
- Any path where a student can read or change another student's data.
- Permission rules scattered across several layers or languages.
- The secret key reachable from browser code or committed to git.
- Server Actions for app features (the brief says to prefer APIs). Actions that come with the template's auth pages are allowed.
- A README or spec that promises something the code doesn't do.

## 3. Constraints (from the brief)

- Next.js 15 or 16, App Router, TypeScript.
- Supabase: `supabase-js`, `@supabase/ssr`, Postgres. Developed locally with the Supabase CLI (Docker).
- Start from `npx create-next-app --example with-supabase`.
- shadcn/ui (bundled with the template) for the UI.

## 4. Domain assumptions (go in the README)

- **A consultation** is a one-to-one slot a student books for help. A later triage step, out of scope, assigns a consultant and sets the duration. `scheduled_at` is the student's preferred time.
- **"Complete"** is the student's own tracking, with no time restriction: it can be marked before the scheduled time. Trade-off: reschedules made outside the system can leave `scheduled_at` inaccurate.
- **Names are stored on the consultation** because the brief puts them on the form. The account email lives in `profiles` (§7), so an admin can see who booked even if the names typed on the form differ from the account.
- **Admins are staff accounts.** They don't book. One role per user.
- **Booking window: 1 to 14 days ahead.**
  - The 24-hour minimum gives the triage step time to assign a consultant.
  - The 14-day maximum fits how far ahead high-school students actually plan.
  - Both are rolling windows from now, not calendar days, so no time zone has to decide when "tomorrow" starts.
- **Business hours (added after the browser walkthrough):** consultations start between 8:00 am and 7:45 pm `Australia/Melbourne` time. Enforced in the service and reflected in the picker.

## 5. Approaches considered

All approaches use the same schema and the same Next.js API routes. They differ in where permission and business rules run.

| | Approach | Trade-off | Verdict |
|---|---|---|---|
| A | Postgres functions (RPC) for each action, no direct table writes | One choke point, but the core logic is in PL/pgSQL: harder to test and maintain, and split across two languages | Rejected: maintainability |
| B | Students write with their own session under RLS, plus column grants and a trigger | Standard Supabase style, but students can call the auto-generated API directly and skip the business rules on their own rows | Rejected: leaves the direct write path open |
| B′ | Reads through the user's session under RLS, writes through the service | Two layers of protection, but permission rules live in both SQL policies and TypeScript | Rejected: rules split across layers |
| **C** | **All access through a server-side TypeScript service using the secret key. RLS enabled with no policies, so it denies everything to anon and authenticated** | One layer, one language, one place for every permission rule. Easy to test and extend. No second safety net if the service has a bug | **Chosen** |

**Why C:** the brief explicitly allows RBAC without RLS if it's justified.

- Keeping every permission and business rule in one TypeScript layer is easier to read, change and test.
- It scales cleanly to more roles: a permissions map in code instead of a growing pile of SQL policies.
- Enabling RLS with *zero policies* still fully closes the direct route into the database. The publishable key and user JWTs can't read or write anything, which matches Supabase's advice to enable RLS on every exposed table.

**Performance:** there's no meaningful difference from RLS. The ownership filter becomes the same indexed `WHERE` clause either way. Approach C also avoids RLS's trap of calling a function once per row. It costs one extra primary-key lookup per request, for the role.

**Risk we accept, and how we reduce it:** the secret key bypasses RLS, so a bug in a route could expose other students' data.
- Only the service module and the role helper may import the privileged client, and that module is marked `server-only`.
- Every service method requires the verified `userId` (and checks role where relevant) and scopes every query by it.
- Tests check that one student can't read or change another's booking, and that a non-admin gets 403 from the admin route.
- README "with more time": add RLS read policies back as a second layer.

## 6. Architecture

```
Browser (React, shadcn/ui)
  │  fetch('/api/...')            ← only data path from the browser
  │  supabase.auth.*              ← only direct Supabase call (login/sign-up/logout)
  ▼
proxy.ts / middleware.ts          session refresh + redirect unauthenticated → /auth/login
                                  (template behaviour; no DB lookups here)
  ▼
Route handlers  app/api/**        CSRF origin check, auth + role guard, zod, HTTP mapping
Route-group layouts               (student)/layout.tsx, (admin)/layout.tsx: same guards → redirect
  ▼
ConsultationService  lib/consultations/service.ts
                                  all business rules + ownership scoping
  ▼
Privileged Supabase client  lib/supabase/admin.ts  ('server-only', SUPABASE_SECRET_KEY)
  ▼
Postgres   RLS on (no policies) · data-integrity constraints only
```

**Layer rules (the consistency story):**

| Kind of rule | Example | Lives in |
|---|---|---|
| Permission: who | owner-only changes, admin-only list | TypeScript (guards + service) |
| Business: when/what transition | booked 24 hours to 14 days ahead, starts 8:00 am to 7:45 pm Melbourne time, cancelled is final | TypeScript (service) |
| Data integrity: what data is valid | status enum, 15-minute alignment, unique active slot | Postgres constraints |

The database keeps only rules that must hold whoever writes, including migrations and seed scripts.

**Identity:** route handlers and layouts get the verified user from the request's cookie session, using the template's server client (`getClaims()` / `getUser()`, which verify the JWT). They never trust a user id sent by the client. The role is read from `user_roles` with the privileged client, through a single helper (`getRole(userId)`). Nothing else compares role strings.

**Role-based routing:** this runs in route-group layouts, not in `proxy.ts`, so the proxy never queries the database and every role decision goes through the same guards.
- `app/(student)/layout.tsx` calls `requireRole('student')`.
- `app/(admin)/layout.tsx` calls `requireRole('admin')`.
- A wrong role redirects to that user's home.
- `/` redirects by role: admin to `/admin`, student to `/dashboard`. Login and sign-up both land on `/`.

**Reads in server components:** pages render initial data by calling the same service functions directly from server components, after the same guards. All mutations go through the API routes. The matching GET routes also exist, for client refetches and API completeness.

README justification: this isn't a Server Action. Next.js advises server components to call the data layer directly rather than make an HTTP request back to their own API, which adds latency and repeats authentication. The permission checks are identical because both paths use the same guards and service.

## 7. Data model (Supabase migrations in `supabase/migrations/`)

```sql
create type public.app_role as enum ('student', 'admin');
create type public.consultation_status as enum ('scheduled', 'completed', 'cancelled');

-- mirror of the auth user's email, so the admin list can show who booked
create table public.profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  created_at timestamptz not null default now()
);

create table public.user_roles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       public.app_role not null default 'student',
  created_at timestamptz not null default now()
);

create table public.consultations (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(user_id) on delete cascade,
  first_name   text not null check (length(btrim(first_name)) between 1 and 100),
  last_name    text not null check (length(btrim(last_name))  between 1 and 100),
  reason       text not null check (length(btrim(reason))     between 1 and 1000),
  scheduled_at timestamptz not null
               -- exact 15-minute alignment: no cast, so fractional seconds can't round into a pass;
               -- epoch is timezone-independent
               check (extract(epoch from scheduled_at) % 900 = 0),
  status       public.consultation_status not null default 'scheduled',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- one active booking per student per slot (completed still occupies the slot)
create unique index consultations_user_slot_active
  on public.consultations (user_id, scheduled_at)
  where status <> 'cancelled';

create index consultations_user_scheduled on public.consultations (user_id, scheduled_at);
create index consultations_scheduled_id   on public.consultations (scheduled_at, id);  -- admin keyset

alter table public.profiles      enable row level security;  -- no policies: deny all
alter table public.user_roles    enable row level security;
alter table public.consultations enable row level security;
revoke all on public.profiles, public.user_roles, public.consultations from anon, authenticated;

-- locked by default: objects created later in public (by migration, Studio or psql)
-- get no grants for anon/authenticated unless a migration grants them on purpose
alter default privileges for role postgres in schema public
  revoke all on tables    from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on functions from anon, authenticated, public;
```

- `consultations.user_id` references `profiles`, which itself cascades from `auth.users`. That lets the admin query embed the email with PostgREST (`select('*, profiles(email)')`).
- The email is copied once, at sign-up. Keeping it in sync when a user changes their email is out of scope and goes in "with more time".

**Triggers (plumbing only, no business logic):**
- `updated_at` touch trigger on `consultations`.
- **Sign-up trigger**, hardened the way Supabase recommends:
  ```sql
  create schema if not exists private;          -- not exposed through the Supabase API
  create function private.handle_new_user()
  returns trigger language plpgsql security definer set search_path = ''
  as $$
  begin
    insert into public.profiles (user_id, email) values (new.id, new.email);
    insert into public.user_roles (user_id) values (new.id);   -- default 'student'
    return new;
  end $$;
  revoke all on function private.handle_new_user() from public, anon, authenticated;
  create trigger on_auth_user_created after insert on auth.users
    for each row execute function private.handle_new_user();
  ```

**Growth path (README):** for several roles per user, change the `user_roles` primary key to `(user_id, role)`. For fine-grained permissions, add `role_permissions (role, permission)` and swap `requireRole` for `requirePermission`. Callers stay the same.

## 8. Business rules (enforced in `ConsultationService`)

**Time window** (applies when booking and rescheduling):
- `scheduled_at` must sit on a 15-minute boundary, with zero seconds. The UI only offers 15-minute options, and the API *rejects* anything else; it doesn't silently round.
- It must be at least 24 hours from now and at most 14 days from now (`now + 24h ≤ scheduled_at ≤ now + 14d`).
  - These are named constants (`MIN_LEAD_HOURS = 24`, `MAX_AHEAD_DAYS = 14`) in `lib/consultations/rules.ts`.
  - The service and the `SlotPicker` import them. The zod schema checks only the 15-minute alignment, because the window depends on `now`; window and hours errors come from the service.
  - The user-facing wording (`HOURS_MESSAGE`, `WINDOW_MESSAGE`, `BOOKING_RULES_SUMMARY`) is built from the same constants, so changing a value takes one line and the text follows.
- **Business hours:** it must start between 8:00 am and 7:45 pm `Australia/Melbourne` wall-clock time (`OPEN_HOUR = 8`, `CLOSE_HOUR = 20`, exclusive). Daylight saving is handled with `Intl`.
- Times are stored as `timestamptz` (UTC). The client sends ISO 8601 with an offset, and the UI shows times in the browser's local time zone.

**One active booking per slot:** enforced by the unique index. Service maps Postgres error `23505` to 409.

**Status changes:**

```
scheduled ──complete──▶ completed
    ▲   ◀──incomplete──     │
    │                       ✗ no reschedule, no cancel
 reschedule (scheduled only)
    │
    └──cancel──▶ cancelled   (final: no change allowed)
```

- Only `scheduled` can be rescheduled or cancelled.
- A past `scheduled` booking can still be cancelled, because the status rules don't depend on time.
- Marking a booking complete or incomplete doesn't re-check the time window.
- Cancel is a soft cancel: it sets the status and never deletes the row. That keeps history for the admin.

**Concurrency:** each status change runs as one conditional update, for example `update ... where id = $1 and user_id = $2 and status = 'scheduled'`. It never reads first and then writes. If zero rows change, the service reads the row once to decide between 404 (missing or not owned) and 409 (wrong status).

**Ownership:** every student query is scoped by `user_id = <verified user>`. Someone else's row gives **404**, not 403, so the response doesn't reveal that the id exists.

**Missing role row:** this fails closed. The user is treated as having no role, so every guarded route returns 403 and every guarded layout redirects to an error page.

## 8a. Security rules for the implementation

These rules are needed because the service holds a key that bypasses RLS. One careless line would undo the design.

1. **No user input in PostgREST filter strings.** Use only `.eq()`, `.gt()`, `.lt()`, `.in()` and similar parameterised builders. Never put user input into `.or('…')` or `.filter('…')` strings. The pagination cursor is decoded and validated with zod (a timestamp and a UUID) before use.
2. **No mass assignment.** Request schemas are `.strict()`, so unknown keys get 400. The service writes each column by name. `user_id` always comes from the verified session, never from the request body. Never spread the body into an insert or update.
3. **Validate route ids.** `[id]` must be a UUID, checked with zod; otherwise 400. A malformed id must never reach Postgres (error `22P02` → 500).
4. **Never return raw database errors.** Known codes are mapped (`23505` → 409). Everything else is logged on the server, and the client gets a generic 500 `{ error: { code: 'internal', message } }`.
5. **Verify the session.** On the server, use `getClaims()` or `getUser()` only, never `getSession()`, which reads the cookie without verifying it.
6. **Cap the page size.** `limit` defaults to 20 and must be at most 100.
7. **The seed script runs locally only.** It aborts unless the Supabase URL's host is `localhost` or `127.0.0.1`, because it deletes users with the secret key.
8. **Security headers** in `next.config`, shipped in build step 1:
   - a basic Content-Security-Policy, with `connect-src` allowing the Supabase URL
   - `frame-ancestors 'none'` and `X-Frame-Options: DENY`
   - `X-Content-Type-Options: nosniff` and `Referrer-Policy: strict-origin-when-cross-origin`

   Reason: `@supabase/ssr` session cookies are readable by browser JavaScript, so headers that limit cross-site scripting (XSS) protect the session. React already escapes user text, and `dangerouslySetInnerHTML` is never used.

## 9. API (route handlers, JSON only)

| Method & path | Role | Action |
|---|---|---|
| `GET /api/consultations` | student | list own (sorted by `scheduled_at`) |
| `POST /api/consultations` | student | book `{firstName, lastName, reason, scheduledAt}` |
| `PATCH /api/consultations/[id]` | student | `{scheduledAt}` → reschedule, or `{completed: boolean}` → toggle. Exactly one field, otherwise 400 |
| `POST /api/consultations/[id]/cancel` | student | cancel |
| `GET /api/admin/consultations` | admin | list all, including cancelled, each row with the account email. Keyset paginated: `?cursor=&limit=` (limit 20 by default, at most 100), ordered by `(scheduled_at, id)`. *If pagination is cut for time, this row and §10 say "first N, unpaginated" and the README lists it under "with more time".* |

- **Validation:** zod schemas in `lib/consultations/schema.ts`, shared by the form and the routes.
- **Errors:** `{ error: { code, message } }`.

| Status | When |
|---|---|
| 400 | validation failed |
| 401 | not logged in |
| 403 | wrong role, or failed the origin check |
| 404 | not found or not owned |
| 409 | slot taken or the status change isn't allowed |

- **CSRF:** Supabase auth cookies are `SameSite=Lax`. On top of that, every change request (POST or PATCH) must be `Content-Type: application/json`, and its `Origin` header must match the host. Otherwise the route returns 403. This lives in one helper and ships in build step 1.
- **Guards:** `lib/auth/guards.ts`. Routes use `requireUser()` and `requireRole(role)`, which throw HTTP errors. Layouts use matching variants that redirect.

## 10. UI (shadcn/ui, built with the frontend and design skills)

> Superseded in part by `2026-11-22-ui-ux-refresh.md`. Where this section and the refresh spec differ, the refresh spec wins.

- `/auth/*`: the template's login, sign-up and logout. **Sign-up change:** confirmations are off locally, so the user goes straight to `/` after sign-up. The template's "check your email" success page is removed, or no longer linked.
- `/dashboard` (student): upcoming and past consultations, split by `scheduled_at` against now. Each row has a complete checkbox, Reschedule (dialog) and Cancel (with confirmation). Cancelled rows are shown muted, with no actions.
- `/consultations/new` (student): the booking form. It uses the **same `SlotPicker`** (date plus 15-minute time select, offering only slots 24 hours to 14 days from now, within business hours, shown in the browser's local time under a one-line note of the rules) as the reschedule dialog.
- `/admin` (admin): a read-only table of all consultations, including cancelled. Columns: account email, first and last name as entered, reason, time, status. Paginated (see the §9 fallback).

**Component quality:**
- Pages are thin server components: guard, call the service, render.
- Interactive pieces are small client components in `components/consultations/`: `ConsultationList`, `ConsultationRow`, `StatusToggle`, `RescheduleDialog`, `CancelDialog`, `BookingForm`, `SlotPicker`, `AdminConsultationTable`.
- API calls go through one typed fetch helper (`lib/api/client.ts`) that understands the error shape.
- Forms use react-hook-form with the shared zod schemas.
- No business rules in components. Their only checks are form validation for UX.

## 11. Repository layout

```
app/
  page.tsx                                 # role redirect
  (student)/layout.tsx  (student)/dashboard/  (student)/consultations/new/
  (admin)/layout.tsx    (admin)/admin/
  auth/ (template)
  api/consultations/route.ts
  api/consultations/[id]/route.ts
  api/consultations/[id]/cancel/route.ts
  api/admin/consultations/route.ts
components/consultations/*
lib/
  supabase/{server,client,admin}.ts        # admin.ts = secret key, 'server-only'
  auth/guards.ts
  api/{client,http}.ts                     # fetch helper; error mapping + origin check
  consultations/{service,schema}.ts
scripts/seed.ts
supabase/migrations/*.sql
supabase/config.toml
docs/superpowers/specs/
.env.example
README.md
```

## 12. Environment and keys

- The variable names follow whatever the installed template uses. The current template uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. The server-only privileged key is **`SUPABASE_SECRET_KEY`**, the newer Supabase naming that matches "publishable". Use that one name everywhere: code, `.env.example` and the README.
  - If the local CLI version only prints the legacy `service_role` key, put that value in the same `SUPABASE_SECRET_KEY` variable and say so in the README.
- Ship `.env.example` with every variable and local defaults or placeholders. `.env*.local` is git-ignored and never committed.

## 13. Testing

- **Vitest unit tests for the service:** time-window edges (including fractional seconds and off-boundary minutes), every allowed and refused status change, and error mapping.
- **Integration tests against local Supabase (`supabase start`):**
  - student A can't read, reschedule, cancel or toggle student B's booking (404)
  - a student calling the admin route gets 403
  - double-booking the same slot gets 409
  - the publishable key and a student's JWT get nothing when calling the Supabase API directly (checks the deny-all RLS)
  - every table in `public` has RLS on. The check runs `select tablename from pg_tables where schemaname = 'public' and not rowsecurity` over a direct Postgres connection to the local database (`pg` package, local DB URL), and it must return nothing.
- **Unit tests for the security rules:** a body with unknown keys gets 400, a non-UUID id gets 400, a limit over 100 gets 400, and the seed script refuses a non-local URL.

## 14. Seed data and scripts

**Seeding uses a Node script with the Supabase admin API,** not SQL inserts into `auth.users`. Hand-written `auth.users` rows need GoTrue's exact columns (`instance_id`, `aud`, `role`, a `crypt()` password, empty strings rather than NULL in the token columns), and they break when the auth service changes.

`scripts/seed.ts` (run with `tsx`, using `SUPABASE_SECRET_KEY` against the local URL):
0. Abort unless the Supabase URL's host is `localhost` or `127.0.0.1` (§8a, rule 7).
1. Delete the demo users by their fixed emails with `auth.admin.deleteUser`. The cascade removes their profiles, roles and consultations, so the script can be re-run safely.
2. Create 1 admin and 2 students with `auth.admin.createUser({ email, password, email_confirm: true })`. The sign-up trigger creates their `profiles` and `user_roles` rows.
3. Promote the admin: `update user_roles set role = 'admin'`.
4. Insert mock consultations for both students, covering every state: upcoming `scheduled`, past `scheduled`, `completed` and `cancelled`.
   - Times are relative to the moment of seeding (the current hour plus or minus offsets), all on 15-minute boundaries.
   - Upcoming `scheduled` rows fall 1–14 days ahead, so they look like real bookings and can be rescheduled within the rules.
   - At least one cancelled and one active booking share a slot, to show the partial unique index allows it.
   - Inserts go straight into the database (no service), so past-dated rows are allowed. Only the time-window rule is skipped this way; every database constraint still applies.

**npm scripts:**
- `npm run db:seed` runs `tsx scripts/seed.ts`. It refreshes the demo data without touching the schema.
- `npm run db:reset` runs `supabase db reset && npm run db:seed`: a full wipe, the migrations, then the seed.

The README lists the demo credentials. `supabase/seed.sql` is not used.

## 15. Build order (5-hour budget)

Items that don't fit become "with more time" notes in the README, and the spec rows they affect are updated so the README and code agree.

1. Scaffold, migrations (including default-privilege revokes), the seed script and npm scripts, the guards, the **CSRF origin check**, the **§8a security rules and headers**, and the core API and service.
2. Frontend: role layouts and redirects, the dashboard, the booking form, the reschedule and cancel dialogs, the admin table.
3. Tests that student A can't touch student B's bookings (404) and that a student gets 403 on the admin route.
4. The test that calling the Supabase API directly gets nothing.
5. Admin pagination (or the §9 fallback).
6. README written as each step lands, finalised at the end (about 30 minutes, protected).
7. **Submission packaging:**
   - a clean git history with small, descriptive commits
   - no `.env.local` or `requirement.txt` committed
   - `.env.example` present
   - a fresh-clone check: `npm i && npm run db:reset && npm run dev` works
   - then submit as a repo link (if private, give the reviewers access) or a zip made with `git archive`

## 16. README contents

1. Setup: Docker, `supabase start`, copy `.env.example` to `.env.local` and fill in the keys from `supabase status`, `npm run db:reset`, `npm run dev`, the demo credentials.
2. Implementation summary and the architecture diagram.
3. Justifications:
   - RBAC without RLS
   - RLS deny-all as a lock
   - the permission / business / integrity layer split
   - performance
   - server components calling the service directly, which isn't a Server Action
   - role routing in layouts rather than the proxy
   - soft cancel
   - 404 rather than 403 for rows the student doesn't own
   - the hardened sign-up trigger
4. Assumptions (§4), including that email confirmation is off locally.
5. Schema and migrations.
6. **Security notes:**
   - the §8a rules
   - locked-by-default grants plus the RLS-on test
   - **booking spam:** there's no per-student limit, but the unique-slot rule and the 14-day window cap active future bookings at about 650 per student (13 days of 48 open slots); rate limiting is the proper fix (see "with more time")
   - **roles take effect immediately:** the role is read on every request, so demoting an admin works at once (a JWT claim would stay stale until the token refreshes)
7. **In production:**
   - Supabase read-only roles for team members on the production project
   - migrations deployed only by CI (`supabase db push` through the GitHub integration or branching), never through Studio or `psql`
   - a scheduled drift check (`supabase db diff --linked`) that fails if the live schema differs from the migrations
   - email confirmation on, and Supabase Auth's built-in rate limits on login and sign-up
8. With more time:
   - role in the JWT through a custom access token hook
   - RLS read policies as a second layer
   - pagination for the student list (and admin, if it was cut)
   - keeping `profiles.email` in sync when a user changes their email
   - an exclusion constraint once durations exist
   - API rate limiting (for example Upstash)
   - a consultant role with `consultant_id` and consultant-side rescheduling
   - separate attendance from student feedback
   - pgTAP and RLS tests if policies are added back
   - a hosted deployment

## 17. Calls made during review (correct if wrong)

- **No role row:** this fails closed (§8).
- **Booking window:** a rolling 24 hours to 14 days from now, not calendar days. The values are constants.
- **Upcoming vs past:** split by date, whatever the status. Superseded by D2 in the UI refresh spec: the student dashboard now groups by display state.
- **A past `scheduled` booking can be cancelled.**
- **Email confirmation is off locally**, and sign-up goes straight to `/`.
- **Admins don't book.**
- **Server components call the service directly;** all changes go through the API.
- **404 for rows the student doesn't own.**
- **The 15-minute check uses the epoch form without a cast.** It's exact and timezone-independent. The `extract(minute …)` form depends on the session time zone.
- **The account email is shown** through a `profiles` table filled by the sign-up trigger, not by reading `auth.users` at query time.
- **The key is named `SUPABASE_SECRET_KEY`.**
- **`requirement.txt` is git-ignored.**

## 18. Left to the builder

- Exact component structure inside the list above, and the styling.
- Whether the booking form prefills names from the student's last booking.
- Next 15 vs 16: use whatever the template installs (`proxy.ts` on 16, `middleware.ts` on 15).
- Demo users' exact emails, passwords and the mock reasons.
