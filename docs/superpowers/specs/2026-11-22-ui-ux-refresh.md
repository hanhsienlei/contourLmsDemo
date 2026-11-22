# Mini-LMS UI/UX refresh: design

Date: 2026-11-22
Status: approved by Hanna, ready to build
Amends: `2026-11-22-mini-lms-design.md` §10 (UI) and the "Upcoming vs past" call in §17. Everything else in that spec still holds. When this file and §10 disagree, this file wins.

## 1. Purpose

Make the three student surfaces and the admin list consistent, clearer about state, and quicker to use, without changing any business rule, API contract or database constraint. This is a UI layer change. The service, the route handlers and the migrations stay as they are.

## 2. Decisions

| # | Decision | Why |
|---|---|---|
| D1 | A past `scheduled` booking keeps its API rule (it can still be cancelled). In the UI, its main actions are Mark complete and Reschedule; Cancel moves into a "More" (⋯) menu. | The UI never contradicts the API. It only changes emphasis. |
| D2 | The student dashboard groups by **display state**, not by date alone: Needs your update, Upcoming, History. | A student's first question is "what do I need to do", and state answers it. |
| D3 | Booking opens in a **Dialog** from the dashboard. `/consultations/new` redirects to `/dashboard?book=1`, which opens the dialog, so the old link still works. | The form is short and launched from the list. The student keeps context and sees the new booking land. |
| D4 | **No per-student booking cap.** Nothing in the UI mentions one. | Matches the API and README. Rate limiting stays under "with more time". |
| D5 | Both views show times in the **browser's time zone with an explicit label** (for example "Times in Adelaide time (ACDT)"). | Keeps today's `LocalTime` behaviour, removes the vague "your local time". |
| D6 | Booking and rescheduling share **one dialog component** with two modes. | One place to maintain, and the two flows look identical. |
| D7 | Seed: the cancelled row that shares Alice's Friday slot keeps its slot and status, but its reason becomes `Physics projectile motion`. | The "Rescheduled:" prefix reads as if reschedule cancels and recreates. Reschedule updates the same row. The shared slot still demonstrates the partial unique index. |

## 3. Global rules

These apply to every step. Put the short version in `CLAUDE.md` (see §9).

1. **Components:** shadcn/ui components from `components/ui/` only. Add new shadcn components with the CLI if needed. No hand-written CSS files; Tailwind utilities with theme tokens (`text-muted-foreground`, `bg-muted`, `border`, `text-destructive`) only. No raw hex colours.
2. **No business rules in components** (unchanged from §10). Display logic that is more than a one-liner lives in `lib/consultations/display.ts` as pure functions with unit tests.
3. **Status is never shown by colour alone.** Every badge carries a text label.
4. **Times:**
   - Absolute: `EEE d MMM, h:mm aaa` (for example "Tue 24 Nov, 10:00 am"), via the existing `formatSlot`.
   - Relative: "in 2 days", "in 3 hours", "3 days ago", via `date-fns` `formatDistanceStrict` with `addSuffix`.
   - Every page that shows times shows one `TimeZoneNote` near the top.
   - All client-time rendering stays hydration-safe through `useMounted`, as `LocalTime` does today.
5. **Copy:** sentence case; buttons are verb first ("Mark complete", "Book consultation"); no "please", no "successfully", no exclamation marks; errors say what happened, then what to do.
6. **Accessibility:** icon-only buttons get `aria-label`; groups of fields use `<fieldset>` and `<legend>`; field errors link with `aria-describedby` (as `BookingForm` already does); dialogs keep focus management from Radix; actions on a row include the slot in their accessible name (as today).
7. **Responsive:** at widths under `sm`, row actions collapse so that only the primary action stays visible and the rest move into the ⋯ menu.

## 4. Display state model

Derived from `status` and `scheduledAt` against `now`. Implement as `displayState(item, now)` in `lib/consultations/display.ts`.

| Display state | Rule | Badge (label, style) | Actions |
|---|---|---|---|
| `upcoming` | `scheduled` and `scheduledAt >= now` | "Scheduled", neutral (`secondary`) | Mark complete, Reschedule, Cancel (all visible on desktop) |
| `needs_update` | `scheduled` and `scheduledAt < now` | "Past, not marked", warning: amber text and border on a light amber background, using Tailwind theme-safe classes that work in dark mode | Mark complete, Reschedule visible; Cancel inside ⋯ |
| `completed` | `completed` | "Completed", success: green text on a light green background | Mark incomplete |
| `cancelled` | `cancelled` | "Cancelled", `outline`, muted text | None |

`StatusBadge` takes a display state, not a raw status. The admin table uses the same badges.

## 5. Shared pieces

| Piece | Location | Change |
|---|---|---|
| `displayState`, `groupForStudent` | `lib/consultations/display.ts` (new) | Pure functions. `groupForStudent(items, now)` returns `{ needsUpdate, upcoming, history: { completed, cancelled } }` with the sort orders in §6.1. Unit tests in `tests/unit/display.test.ts`, including the boundary where `scheduledAt === now`. |
| `StatusBadge` | existing | Accepts a display state; styles per §4. |
| `ConsultationTime` | new, replaces direct `LocalTime` use in rows | Two lines: absolute time (medium weight), then relative time (muted, small). Renders `<time dateTime>`. Hydration-safe. |
| `TimeZoneNote` | new | One muted line: clock icon plus "Times in {city} time ({abbr})". City from `Intl.DateTimeFormat().resolvedOptions().timeZone` (last segment, underscores to spaces); abbreviation from `timeZoneName: 'short'` with locale `en-AU`. Falls back to the IANA name. Hydration-safe. |
| `CompleteButton` | new, replaces `StatusToggle` | A `Button` (`variant="outline"`, `size="sm"`): "Mark complete" when scheduled, "Mark incomplete" when completed. Same PATCH call and toasts as today ("Marked complete", "Marked incomplete"). |
| `RowActionsMenu` | new | `DropdownMenu` behind a ghost icon button (`aria-label="More actions for consultation on {slot}"`). Holds Cancel for `needs_update` rows, and every secondary action under `sm`. |
| `SlotPicker` | existing, extended | See §6.2. |
| `ConsultationDialog` | new, replaces `BookingForm` page usage and `RescheduleDialog` | `mode: 'book' \| 'reschedule'`. See §6.2 and §6.3. |
| `CancelDialog` | existing | Copy and behaviour stay. Its trigger can render as a menu item or a button. |

## 6. Screens

### 6.1 Student dashboard (`/dashboard`)

Layout, top to bottom:

1. Header row: `h1` "Your consultations", then `TimeZoneNote` under it; "Book a consultation" primary button on the right (opens the dialog).
2. **Needs your update** (rendered only when non-empty): section heading with an alert icon in warning colour. Rows are `needs_update`, most recent first. Each row's second line ends with "Did this happen?".
3. **Upcoming** with a count badge: `upcoming` rows, soonest first. Empty state: "Nothing booked yet" plus a "Book a consultation" button.
4. **History**: `completed` rows, most recent first. Then a ghost toggle "Show cancelled (n)", collapsed by default, revealing `cancelled` rows, most recent first. Section hidden when both lists are empty.

Row anatomy (all sections):

- Title: the **reason** (one line, truncated with `title` attribute holding the full text). The first and last name are **not** shown on the student's own rows.
- Second line: `ConsultationTime` (absolute plus relative).
- Right side: `StatusBadge`, then the actions from §4.
- Cancelled rows: muted background and text, no actions.

Whole-page empty state (no consultations at all): centred card, "Book your first consultation", one line explaining what a consultation is, primary button.

Acceptance criteria:

- [ ] Seeded Alice shows: Needs your update (Chemistry), Upcoming (Methods, English), History (Specialist Maths, Term 3 study plan) and "Show cancelled (1)".
- [ ] No row shows "Alice Nguyen:".
- [ ] The Chemistry row shows Mark complete and Reschedule; Cancel is reachable from ⋯ and still works.
- [ ] Marking Methods complete moves it to History after refresh, with toast "Marked complete".
- [ ] Every row's state is readable with colours disabled.

### 6.2 Book dialog (mode `book`)

Opened from "Book a consultation", or on load when the URL has `?book=1` (then the param is removed with `router.replace`).

Content, top to bottom:

1. Title "Book a consultation"; close (X) button.
2. First name, Last name side by side, **pre-filled from the student's most recent booking** (any status), still editable. Empty if there is none.
3. Reason: `Textarea`, placeholder with a real example ("Go over my Methods SAC practice questions"), helper "What would you like help with?", live character counter `n/{max}` using the max length from the shared zod schema.
4. Fieldset "When":
   - Help line built from the rules constants: "Book 1 to 14 days ahead, 8:00 am to 7:45 pm Melbourne time." plus `TimeZoneNote`. Build the text from `MIN_LEAD_HOURS`, `MAX_AHEAD_DAYS` and the hours constants so it can't drift; add a constant in `rules.ts` if needed.
   - Day: `Select` (unchanged behaviour).
   - Time: a **grid of slot buttons** for the chosen day, grouped under "Morning" (before 12:00), "Afternoon" (12:00 to 16:59) and "Evening" (17:00 on), in local time. Selected slot uses the primary style; `aria-pressed` reflects selection. Before a day is chosen, show "Choose a day first" in place of the grid.
   - Slots where the student already has an active booking (`scheduled` or `completed`, matching the unique index) are shown disabled with a strikethrough and a tooltip/title "You already have a booking at this time". This is a convenience only; the database index and the 409 stay the authority.
5. Footer: "Cancel" (closes) and the submit button. The submit label reads "Book consultation" until a slot is chosen, then "Book for {absolute time}". While sending: "Booking…" and disabled.

Behaviour:

- Success: dialog closes, toast "Consultation booked", list refreshes (existing `useApiAction`).
- Server errors keep using the API's plain-English messages through the existing toast. A 400 with field details shows under the matching field.
- The dashboard passes the student's active slots to the dialog (it already has the list), so no extra request is needed.

Acceptance criteria:

- [ ] `/consultations/new` lands on the dashboard with the dialog open.
- [ ] Names are pre-filled for Alice.
- [ ] The slot of Alice's active English booking is disabled in the grid; the cancelled booking at the same time does not block anything else.
- [ ] Forcing a duplicate slot through the API still returns 409 and shows the server message.

### 6.3 Reschedule dialog (mode `reschedule`)

Same component, showing only the "When" fieldset.

1. Title "Reschedule consultation".
2. Description: the reason in medium weight, then "Currently {absolute time}".
3. Day defaults to the booking's own day if it is still bookable, otherwise the first bookable day.
4. The booking's current slot is shown as "Current" and disabled. Other occupied slots are disabled as in §6.2.
5. Footer: "Cancel" and the submit button: "Reschedule" until a slot is chosen, then "Move to {absolute time}"; "Rescheduling…" while sending.
6. Success toast: "Moved to {absolute time}". The same row updates in place after refresh.
7. A 409 because the booking changed elsewhere shows the server message and suggests refreshing.

Acceptance criteria:

- [ ] Rescheduling Methods changes its time on the same row; no new or cancelled row appears.
- [ ] The Chemistry (past) booking can be rescheduled into the window.

### 6.4 Cancel confirmation

No change in copy or behaviour ("Cancel this consultation?", "Keep it", destructive "Cancel consultation"). It must work when triggered from the ⋯ menu: the menu closes, then the AlertDialog opens with focus on "Keep it".

### 6.5 Admin list (`/admin`)

1. Header: `h1` "All consultations", an "Admin" badge (from the shell or the page), and a muted "Read-only" label with a lock icon. `TimeZoneNote` under the heading.
2. Table columns:
   - **Time:** `ConsultationTime` (absolute plus relative).
   - **Student:** name as entered on the first line, account email muted on the second.
   - **Reason:** single line, truncated, full text in `title`.
   - **Status:** `StatusBadge` with display state, so past unmarked bookings read "Past, not marked".
3. Rows with `needs_update` get a light warning background. Cancelled rows are muted.
4. Pagination stays keyset (`cursor`). Render "First page" and "Next page" as `Button` links (`variant="outline"`, `size="sm"`) in a footer bar. No total count (keyset pagination doesn't produce one cheaply; say so in the README).
5. Empty state: "No consultations yet."

Stretch (only if time allows, and only with a matching service and schema change plus tests): a status filter as a `ToggleGroup` (All, Upcoming, Past not marked, Completed, Cancelled) stored in the URL as `?status=`, combined with the cursor.

Acceptance criteria:

- [ ] The Chemistry booking shows "Past, not marked" with a highlighted row.
- [ ] Page 2 via `cursor` still works and invalid cursors still show the existing message.

## 7. Build order for Claude Code

Each step: start in plan mode, implement, run `npm run lint`, `npm test`, then open the page and check it against the acceptance criteria, then commit with a focused message.

1. `lib/consultations/display.ts` + unit tests (§4, §5).
2. `StatusBadge`, `ConsultationTime`, `TimeZoneNote`, `CompleteButton`, `RowActionsMenu`.
3. Student dashboard grouping and row anatomy (§6.1).
4. `SlotPicker` grid, occupied and current slots (§6.2, §6.3).
5. `ConsultationDialog` in both modes; replace `RescheduleDialog`; dashboard trigger; `/consultations/new` redirect (§6.2, §6.3).
6. Cancel from the ⋯ menu (§6.4).
7. Admin list (§6.5).
8. Seed reason fix (D7), then `npm run db:reset` and walk through every acceptance criterion as Alice, Bob and the admin.
9. Update `2026-11-22-mini-lms-design.md` §10 and §17 to point here, and add a short "UI decisions" section to the README covering D1 to D6.

## 8. Out of scope

Booking caps, request rate limiting, consultant roles, durations and clash detection, email notifications, and visual restyling of the auth pages. These stay in the README's "with more time" list.

## 9. Suggested `CLAUDE.md` (repo root)

```md
@AGENTS.md

## UI work
- UI and UX changes follow `docs/superpowers/specs/2026-11-22-ui-ux-refresh.md`. It wins over §10 of the mini-LMS design spec.
- Use shadcn/ui components from `components/ui/` and Tailwind theme tokens. No custom CSS files, no raw hex colours.
- No business rules in components. Display logic goes in `lib/consultations/display.ts` with unit tests.
- Never change API contracts, service rules or migrations as part of a UI task.
```
