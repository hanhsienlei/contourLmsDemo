# Mini-LMS: consultation booking

A take-home for Contour's Software Engineer role. Students sign up, book consultations, and reschedule, cancel or mark them complete. Admins see every consultation, read-only.

Stack: Next.js 16 (App Router, TypeScript), Supabase (Auth, Postgres, local CLI), `@supabase/ssr`, shadcn/ui, zod, Vitest.

The full design, including the options I rejected, is in [`docs/superpowers/specs/`](docs/superpowers/specs/).

## Setup

You need Node.js 20.12+ and Docker running.

```bash
npm ci
npx supabase start            # first run pulls the Docker images
cp .env.example .env.local
npx supabase status -o env    # copy the values below into .env.local
npm run db:reset              # migrations + demo data
npm run dev                   # http://localhost:3000
```

| `.env.local` | From `supabase status -o env` |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `API_URL` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `PUBLISHABLE_KEY` |
| `SUPABASE_SECRET_KEY` | `SECRET_KEY` (server only) |
| `SUPABASE_DB_URL` | `DB_URL` (integration tests only) |

### Demo accounts

All use the password `Password123!`.

| Email | Role | Data |
|---|---|---|
| `admin@demo.local` | admin | none |
| `alice@demo.local` | student | a few bookings, one in each state |
| `bob@demo.local` | student | 90+ bookings, so every tab has a second page |

Booking times are relative to when you seed. Run `npm run db:seed` to refresh them. You can also sign up with any email (confirmation is off locally); new accounts are students.

To make someone an admin, run this as `postgres` (for example in Supabase Studio):

```sql
update public.user_roles set role = 'admin'
where user_id = (select user_id from public.profiles where email = 'someone@example.com');
```

### Scripts

```bash
npm test             # unit + integration tests (needs supabase running)
npm run test:unit    # unit tests only
npm run lint
npm run typecheck
npm run db:seed      # recreate the demo users and their bookings
npm run db:types     # regenerate lib/supabase/database.types.ts
```

## What's built

- **Auth:** sign up (with first and last name), log in, log out, through Supabase Auth.
- **Student dashboard** (`/dashboard`): status tabs (Upcoming, Needs update, Completed, Cancelled) over a table of your bookings, 20 per page. Each row can be marked complete or incomplete, rescheduled or cancelled. Clicking a reason shows the full text.
- **Booking:** a dialog with first name, last name, reason and a time slot.
- **Admin** (`/admin`): the same table across all students, with the student's name and email, and no actions.

Both views use one table component; each page chooses its columns, so the admin page simply has no actions column.

## How it works

```
Browser ── fetch('/api/...') ──▶ Route handlers (app/api)   origin check, role guard, zod
   │                                   │
   └── Pages (server components) ──────┤   role guard on every page
                                       ▼
                         lib/consultations/service.ts      business rules, queries scoped by user
                                       ▼
                         Supabase (secret key)             RLS on, no policies
```

- **All writes go through API routes.** There are no Server Actions. Pages read through the same service functions directly, after the same role check, rather than calling their own API over HTTP.
- **Roles** live in a `user_roles` table and are read from the database on every request, so a role change takes effect at once. `requireRole()` guards API routes (401/403 JSON) and `requireRolePage()` guards pages (redirect).
- **The session** is checked with `getClaims()`, which verifies the JWT. A user id from the client is never trusted.

### API

Errors are `{ "error": { "code", "message" } }`.

| Method and path | Role | Does |
|---|---|---|
| `GET /api/consultations?group=&cursor=` | student | one page of your bookings in one tab |
| `POST /api/consultations` | student | book `{ firstName, lastName, reason, scheduledAt }` |
| `PATCH /api/consultations/[id]` | student | `{ scheduledAt }` to reschedule, or `{ completed }` to toggle |
| `POST /api/consultations/[id]/cancel` | student | cancel |
| `GET /api/admin/consultations?group=&cursor=` | admin | one page of all bookings in one tab |

Status codes: 400 invalid input, 401 not signed in, 403 wrong role or bad origin, 404 not found or not yours, 409 slot taken or status change not allowed.

### Status rules

```
scheduled ⇄ completed        (mark complete / incomplete)
scheduled → cancelled        (final)
reschedule: scheduled only
```

Each change is a single conditional update (`WHERE id = … AND user_id = … AND status = …`), so two requests can't both apply. A database trigger enforces the same rules as a backstop.

## Justifications

**RBAC in TypeScript, not RLS policies.** The brief allows this if justified. All data access goes through one server-side service using the secret key, and every query is scoped by the verified user id. Permission and business rules live in one language and one layer, which is easier to read and test. RLS is still enabled with no policies, and table privileges are revoked from `anon` and `authenticated`, so the public Supabase API can't read or write anything directly. A test proves this. The trade-off: a bug in the service could leak data, because the secret key bypasses RLS. RLS read policies as a second layer would be the next step.

**Cancel is a soft delete.** The row stays with `status = 'cancelled'`, so admins keep the history, and the slot frees up for a new booking.

**404, not 403, for someone else's booking**, so the response doesn't reveal that the id exists.

**Keyset pagination** on `(scheduled_at, id)`, which stays fast at any depth, unlike `OFFSET`.

**Security basics:** strict zod schemas (unknown keys rejected), UUID-checked route ids, an Origin and Content-Type check on every write, generic 500 messages, a nonce-based Content-Security-Policy, and a hardened sign-up trigger that always assigns the student role.

## Assumptions

- A consultation is a slot a student books for help. Consultants and durations are out of scope.
- Bookings must be 24 hours to 14 days ahead, on the quarter hour, between 8:00 am and 7:45 pm Melbourne time. A student can't hold two active bookings at the same time.
- "Complete" is the student's own tracking and can be set at any time.
- After booking, only the time and the status can change. To change the reason, cancel and book again.
- Admins are staff: they don't book and can't change anything. Each user has one role.
- Times are stored in UTC and shown in the browser's time zone.

## Schema and migrations

Migrations are in [`supabase/migrations/`](supabase/migrations/) and applied in order by `npm run db:reset`.

| Table | Columns |
|---|---|
| `profiles` | `user_id` (PK, FK `auth.users`), `email`, `first_name`, `last_name`, `created_at` |
| `user_roles` | `user_id` (PK, FK `auth.users`), `role` (`student` \| `admin`, default `student`), `created_at` |
| `consultations` | `id`, `user_id` (FK `profiles`), `first_name`, `last_name`, `reason`, `scheduled_at`, `status` (`scheduled` \| `completed` \| `cancelled`), `created_at`, `updated_at` |

- Constraints: names 1–100 characters, reason 1–1000, `scheduled_at` on a 15-minute boundary, and a partial unique index on `(user_id, scheduled_at)` for bookings that aren't cancelled.
- Indexes: `(user_id, scheduled_at)` for the student's list, `(scheduled_at, id)` for the admin list.
- Triggers: create the profile and role on sign-up, keep `updated_at` current, and guard the status rules.

## With more time

- RLS read policies as a second layer under the service.
- Rate limiting on the API.
- An index on `(status, scheduled_at, id)` and cheaper counts for the admin tabs at scale.
- A "check your email" step for when email confirmation is turned on.
- End-to-end browser tests and a hosted deployment.
