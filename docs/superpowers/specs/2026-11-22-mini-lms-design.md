# Mini-LMS (Contour take-home): Design

Date: 2026-11-22
Source brief: `requirement.txt` (project root)

## 1. Intent

A take-home for Contour's Software Engineer role, due 48 hours after the email. It is a small LMS where students book and manage consultations and admins see every consultation, read-only.

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

**Non-goals (written in the README as assumptions or future work)**
- Teachers, consultants or staff assignment. No `teacher_id` or `consultant_id`.
- Subject or category, duration, availability calendars, overlap checks between people.
- A limit on active bookings per student (considered and dropped).
- Admins writing anything.
- Email notifications.

**Anti-goals (failure even if it "works")**
- Any path where a student can read or change another student's data.
- Permission rules scattered across several layers or languages.
- The service-role key reachable from browser code.
- Server Actions for app features (the brief says to prefer APIs). Actions that come with the template's auth pages are allowed.

## 3. Constraints (from the brief)

- Next.js 15 or 16, App Router, TypeScript.
- Supabase: `supabase-js`, `@supabase/ssr`, Postgres. Developed locally with the Supabase CLI (Docker).
- Start from `npx create-next-app --example with-supabase`.
- shadcn/ui (bundled with the template) for the UI.

## 4. Domain assumptions (go in the README)

- **A consultation** is a one-to-one slot a student books for help. A later triage step, out of scope, assigns a consultant and sets the duration. `scheduled_at` is the student's preferred time.
- **"Complete"** is the student's own tracking, with no time restriction: it can be marked before the scheduled time. Trade-off: reschedules made outside the system can leave `scheduled_at` inaccurate.
- **Names are stored on the consultation** because the brief puts them on the form. They are not on a profile. The form may prefill them from the last booking (builder's call), but each row stores its own copy.
- **Admins are staff accounts.** They don't book. One role per user.

## 5. Approaches considered

All approaches use the same schema and the same Next.js API routes. They differ in where permission and business rules run.

| | Approach | Trade-off | Verdict |
|---|---|---|---|
| A | Postgres functions (RPC) for each action, no direct table writes | One choke point, but the core logic is in PL/pgSQL: harder to test and maintain, and split across two languages | Rejected: maintainability |
| B | Students write with their own session under RLS, plus column grants and a trigger | Standard Supabase style, but students can call the auto-generated API directly and skip the business rules on their own rows | Rejected: leaves the direct write path open |
| B′ | Reads through the user's session under RLS, writes through the service | Two layers of protection, but permission rules live in both SQL policies and TypeScript | Rejected: rules split across layers |
| **C** | **All access through a server-side TypeScript service using the service-role key. RLS enabled with no policies, so it denies everything to anon and authenticated** | One layer, one language, one place for every permission rule. Easy to test and extend. No second safety net if the service has a bug | **Chosen** |

**Why C:** the brief explicitly allows RBAC without RLS if it's justified.

- Keeping every permission and business rule in one TypeScript layer is easier to read, change and test.
- It scales cleanly to more roles: a permissions map in code instead of a growing pile of SQL policies.
- Enabling RLS with *zero policies* still fully closes the direct route into the database. The public key and user JWTs can't read or write anything, which matches Supabase's advice to enable RLS on every exposed table.

**Performance:** there's no meaningful difference from RLS. The ownership filter becomes the same indexed `WHERE` clause either way. Approach C also avoids RLS's trap of calling a function once per row. It costs one extra primary-key lookup per request, for the role.

**Risk we accept, and how we reduce it:** the service-role key bypasses RLS, so a bug in a route could expose other students' data.
- Only the service module may import the privileged client, and that module is marked `server-only`.
- Every service method requires the verified `userId` (and checks role where relevant) and scopes every query by it.
- Tests check that one student can't read or change another's booking, and that a non-admin gets 403 from the admin route.
- README "with more time": add RLS read policies back as a second layer.

## 6. Architecture

```
Browser (React, shadcn/ui)
  │  fetch('/api/...')            ← only data path from the browser
  │  supabase.auth.*              ← only direct Supabase call (login/sign-up/logout)
  ▼
proxy.ts / middleware.ts          session refresh, redirect unauthenticated users (template)
  ▼
Route handlers  app/api/**        auth guard, role guard, zod validation, HTTP mapping
  ▼
ConsultationService  lib/consultations/service.ts
                                  all business rules + ownership scoping
  ▼
Privileged Supabase client  lib/supabase/admin.ts  ('server-only', SUPABASE_SERVICE_ROLE_KEY)
  ▼
Postgres   RLS on (no policies) · data-integrity constraints only
```

**Layer rules (the consistency story):**

| Kind of rule | Example | Lives in |
|---|---|---|
| Permission: who | owner-only changes, admin-only list | TypeScript (guards + service) |
| Business: when/what transition | ≤ 1 month ahead, cancelled is final | TypeScript (service) |
| Data integrity: what data is valid | status enum, 15-minute alignment, unique active slot | Postgres constraints |

The database keeps only rules that must hold whoever writes, including migrations and seed scripts.

**Identity:** route handlers get the verified user from the request's cookie session, using the template's server client (`getClaims()` / `getUser()`, which verify the JWT). They never trust a user id sent by the client. The role is read from `user_roles` with the privileged client, through a single helper (`getRole(userId)`). Nothing else compares role strings.

**Reads in server components (builder may adjust):** pages render initial data by calling the same service functions directly from server components, after the same guards. A page doesn't make an HTTP request back to its own API. All mutations go through the API routes. The matching GET routes also exist, for client refetches and to keep the API complete.

## 7. Data model (Supabase migrations in `supabase/migrations/`)

```sql
create type app_role as enum ('student', 'admin');
create type consultation_status as enum ('scheduled', 'completed', 'cancelled');

create table public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role    app_role not null default 'student',
  created_at timestamptz not null default now()
);

create table public.consultations (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  first_name   text not null check (length(btrim(first_name)) between 1 and 100),
  last_name    text not null check (length(btrim(last_name))  between 1 and 100),
  reason       text not null check (length(btrim(reason))     between 1 and 1000),
  scheduled_at timestamptz not null
               check (extract(epoch from scheduled_at)::bigint % 900 = 0),  -- 15-min aligned
  status       consultation_status not null default 'scheduled',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- one active booking per student per slot (completed still occupies the slot)
create unique index consultations_user_slot_active
  on public.consultations (user_id, scheduled_at)
  where status <> 'cancelled';

create index consultations_user_scheduled on public.consultations (user_id, scheduled_at);
create index consultations_scheduled      on public.consultations (scheduled_at);  -- admin list

alter table public.user_roles    enable row level security;  -- no policies: deny all
alter table public.consultations enable row level security;  -- no policies: deny all
-- also revoke all on both tables from anon, authenticated (belt and braces)
```

**Triggers (plumbing only, no business logic):**
- `updated_at` touch trigger on `consultations`.
- On `auth.users` insert, a `security definer` trigger inserts `user_roles (user_id, 'student')`.

**Admin accounts:** `supabase/seed.sql` creates a demo admin and a demo student for local review, with credentials in the README. The README also gives the one-line SQL to promote an existing user. There is no UI path to become admin.

**Growth path (README):** for several roles per user, change the `user_roles` primary key to `(user_id, role)`. For fine-grained permissions, add `role_permissions (role, permission)` and swap `requireRole` for `requirePermission`. Callers stay the same.

## 8. Business rules (enforced in `ConsultationService`)

**Time window** (applies when booking and rescheduling):
- `scheduled_at` must sit on a 15-minute boundary. The UI only offers 15-minute options, and the API *rejects* anything else; it doesn't silently round.
- It must be strictly in the future (`> now()`).
- It must be within one month (`<= now() + 1 month`).
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
- Marking a booking complete or incomplete doesn't re-check the time window.
- Cancel is a soft cancel: it sets the status and never deletes the row. That keeps history for the admin.

**Concurrency:** each status change runs as one conditional update, for example `update ... where id = $1 and user_id = $2 and status = 'scheduled'`. It never reads first and then writes. If zero rows change, the service reads the row once to decide between 404 (missing or not owned) and 409 (wrong status).

**Ownership:** every student query is scoped by `user_id = <verified user>`. Someone else's row gives **404**, not 403, so the response doesn't reveal that the id exists.

## 9. API (route handlers, JSON only)

| Method & path | Role | Action |
|---|---|---|
| `GET /api/consultations` | student | list own (sorted by `scheduled_at`) |
| `POST /api/consultations` | student | book `{firstName, lastName, reason, scheduledAt}` |
| `PATCH /api/consultations/[id]` | student | `{scheduledAt}` → reschedule, or `{completed: boolean}` → toggle. Exactly one field, otherwise 400 |
| `POST /api/consultations/[id]/cancel` | student | cancel |
| `GET /api/admin/consultations` | admin | list all, paginated (`?cursor=&limit=`, ordered by `scheduled_at, id`) |

- **Validation:** zod schemas in `lib/consultations/schema.ts`, shared by the form and the routes.
- **Errors:** `{ error: { code, message } }`.

| Status | When |
|---|---|
| 400 | validation failed |
| 401 | not logged in |
| 403 | wrong role |
| 404 | not found or not owned |
| 409 | slot taken or the status change isn't allowed |

- **CSRF:** Supabase auth cookies are `SameSite=Lax`. Change requests must be `Content-Type: application/json`, and their `Origin` must match the host. Otherwise the route returns 403.
- **Guards:** `lib/auth/guards.ts`, with `requireUser()` and `requireRole(role)`. Every route calls one of them first.

## 10. UI (shadcn/ui)

- `/auth/*`: the template's login, sign-up and logout.
- `/dashboard` (student): upcoming and past consultations. Each row has a complete checkbox, Reschedule (a dialog with date plus 15-minute time select) and Cancel (with confirmation). Cancelled rows are shown muted, with no actions.
- `/consultations/new` (student): the booking form.
- `/admin` (admin): a read-only table of all consultations (student name, reason, time, status), paginated.
- **Redirects:** after login, admins go to `/admin` and students to `/dashboard`. Each role gets a redirect away from the other's pages.

## 11. Repository layout

```
app/
  api/consultations/route.ts
  api/consultations/[id]/route.ts
  api/consultations/[id]/cancel/route.ts
  api/admin/consultations/route.ts
  dashboard/  consultations/new/  admin/  auth/ (template)
lib/
  supabase/{server,client,admin}.ts   # admin.ts = service-role, 'server-only'
  auth/guards.ts
  consultations/{service,schema}.ts
supabase/
  migrations/*.sql
  seed.sql
docs/superpowers/specs/
README.md
```

## 12. Testing

- **Vitest unit tests for the service:** time-window edges, every allowed and refused status change, and error mapping.
- **Integration tests against local Supabase (`supabase start`):**
  - student A can't read, reschedule, cancel or toggle student B's booking (404)
  - a student calling the admin route gets 403
  - double-booking the same slot gets 409
  - the public key and a student's JWT get nothing when calling the Supabase API directly (checks the deny-all RLS)

## 13. README contents

1. Setup: Docker, `supabase start`, `supabase db reset` (migrations + seed), `.env.local` (including `SUPABASE_SERVICE_ROLE_KEY`), `npm run dev`, demo credentials.
2. Implementation summary and the architecture diagram.
3. Justifications:
   - RBAC without RLS
   - RLS deny-all as a lock
   - the permission / business / integrity layer split
   - performance
   - soft cancel
   - 404 rather than 403 for rows the student doesn't own
4. Assumptions (§4).
5. Schema and migrations.
6. With more time:
   - role in the JWT through a custom access token hook
   - RLS read policies as a second layer
   - an exclusion constraint once durations exist
   - API rate limiting (for example Upstash)
   - a consultant role with `consultant_id` and consultant-side rescheduling
   - separate attendance from student feedback
   - pgTAP and RLS tests if policies are added back

## 14. Delivery, seed data and time budget (decided by the candidate)

**Local only.** No hosted deployment; reviewers run it in Docker with the Supabase CLI.

**Seed data** (`supabase/seed.sql`, runs on every `supabase db reset`):
- 1 admin and 2 students, with fixed emails and passwords listed in the README. Users are inserted into `auth.users` and `auth.identities` so the password login works, and the sign-up trigger gives them `user_roles` rows (the admin is then promoted).
- Mock consultations for both students, covering every state: upcoming `scheduled`, past `scheduled`, `completed` and `cancelled`.
  - Times are relative to the moment of seeding (for example `date_trunc('hour', now()) + interval '2 days 15 minutes'`), so the data always looks current.
  - All times sit on 15-minute boundaries.
  - At least one cancelled and one active booking share a slot, to show the partial unique index allows it.
- Seed inserts go straight into the database (no service), so past-dated rows are allowed. Only the time-window rule is skipped this way; every constraint still applies.

**Seed/refresh script:** `npm run db:reset` runs `supabase db reset`, which wipes the local database and re-applies migrations and seed. It's documented in the README.
- A lighter `npm run db:seed` re-runs only `seed.sql` against the running database, without re-running migrations. To make that safe to repeat, `seed.sql` first deletes the demo users by fixed id; the cascade removes their roles and consultations.

**Time budget: 5 hours maximum.** Build order; items that don't fit become "with more time" notes in the README:
1. Scaffold, migrations, seed and reset script, core API and service, plus the auth and role guards.
2. Frontend: dashboard, booking form, reschedule and cancel dialogs, admin table.
3. Tests that student A can't touch student B's bookings (404) and that a student gets 403 on the admin route.
4. The test that calling the Supabase API directly gets nothing.
5. The CSRF origin check and the role redirects.
6. Pagination on the admin list.
7. README written as each step lands, finalised at the end. Its time is protected: about 30 minutes.

**Frontend quality:** build the UI with the available frontend and design skills, on shadcn/ui. Components must be small and clean:
- Pages stay thin server components that fetch data through the service.
- Interactive pieces are small client components in `components/consultations/`: `ConsultationList`, `ConsultationRow`, `BookingForm`, `RescheduleDialog`, `CancelDialog`, `StatusToggle`, `AdminConsultationTable`.
- API calls go through one typed fetch helper (`lib/api/client.ts`) that understands the error shape.
- Forms use react-hook-form with the shared zod schemas.
- No business rules in components. Their only checks are form validation for UX.

## 15. Calls made during the builder check (correct if wrong)

- **No `user_roles` row:** this fails closed. The user is treated as having no role, so every guarded route returns 403.
- **"One month":** a calendar month, `now() + interval '1 month'` (`addMonths` in TypeScript).
- **Upcoming vs past on the dashboard:** split by `scheduled_at` compared with now, whatever the status.
- **Cancelling a past `scheduled` booking:** allowed. The status rules don't depend on time; only the time window does, and it applies to booking and rescheduling.
- **Email confirmation:** off for local development (the Supabase CLI default, `enable_confirmations = false`), so sign-up logs straight in. This goes in the README.

## 16. Left to the builder

- Exact component structure and styling.
- Whether the booking form prefills names.
- The pagination page size.
- Next 15 vs 16: use whatever the template installs (`proxy.ts` on 16, `middleware.ts` on 15).
- How to create the seed users (`auth.users` inserts in `seed.sql`, or a small Node script with the admin API).
