# UI/UX refresh, steps 2–9: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the UI/UX refresh from §7 steps 2–9. That covers the shared row pieces, the dashboard grouped by state, the slot grid, one booking and reschedule dialog, cancel from the ⋯ menu, the admin list, the seed reason fix, and docs.

**Architecture:** Every display decision is a pure function in `lib/consultations/display.ts` with a unit test. Components in `components/consultations/` only render what those functions return. Pages stay thin server components. No API, service, schema or migration changes.

**Tech Stack:** Next 16 App Router, React 19, shadcn/ui (`components/ui/`), Tailwind 3, date-fns 4, react-hook-form + zod 4, sonner, lucide-react, vitest (node env; no component test harness).

**Spec:** `docs/superpowers/specs/2026-11-22-ui-ux-refresh.md`. Step 1 is done (`lib/consultations/display.ts`: `DisplayState`, `DISPLAY_STATE_LABEL`, `displayState`, `groupForStudent`).

## Global Constraints

- shadcn/ui components from `components/ui/` only; add new ones with `npx shadcn@latest add <name>`. No CSS files, no raw hex colours. Tailwind tokens, plus the amber and green palette classes §4 asks for, with `dark:` variants.
- No business rules in components. Display logic that's more than a one-liner goes in `display.ts` with tests.
- Never change API contracts, service rules or migrations. (Seed data is changed only in Task 8, per D7.)
- Status is never colour alone; every badge has its text label.
- Absolute time via `formatSlot` (`EEE d MMM, h:mm aaa`); relative time via `formatDistanceStrict(..., { addSuffix: true })`; one `TimeZoneNote` per page that shows times; client-time rendering is gated by `useMounted`.
- Copy: sentence case, verb-first buttons, no "please", "successfully" or "!"; errors say what happened, then what to do.
- Accessibility: icon-only buttons get `aria-label`; groups of fields use `fieldset`/`legend`; field errors use `aria-describedby`; row actions include the slot in their accessible name.
- Under `sm`, only the primary action stays visible and the rest move to ⋯.
- Before using any Next API, read its page in `node_modules/next/dist/docs/` (AGENTS.md).
- After each task: run `npm run lint`, `npm run typecheck` and `npm test`, check the page in the browser against the task's criteria, then commit with a focused message ending in the `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` line.

## Calls made in this plan (correct if wrong)

1. **Primary action** (stays visible under `sm`) is the first action in §4's list: Mark complete for upcoming and needs-update rows, Mark incomplete for completed rows.
2. **"400 with field details"** (§6.2): the API returns a single `{ code, message }` with no field paths, and contracts are frozen. So client-side zod errors appear under fields (as today), and a server 400 appears as a toast with the API's message.
3. **Opening dialogs from the ⋯ menu:** Reschedule and Cancel become controlled dialogs (`open`/`onOpenChange`, optional trigger) from Task 3, because under `sm` both live in the menu. Task 6 is then about the focus handover and checking it against §6.4.
4. **The "Admin" badge** goes on the admin page header, not in the shared shell.
5. **"Most recent booking" for name pre-fill** means the latest `createdAt`.
6. **TimeZoneNote fallback:** if `Intl` throws or gives no zone, show the raw IANA string (or "your local time" if there's none).
7. **The Book-dialog `?book=1`** is read on the server via `searchParams` and passed as a prop, so no `useSearchParams` or Suspense boundary is needed. The client clears it with `router.replace('/dashboard')`.
8. **Browser checks** use the dev server at `http://localhost:3000` with seeded accounts (`alice@demo.local`, `bob@demo.local`, `admin@demo.local`, password `Password123!`).

## Review Focus

1. **Hydration:** relative times, time-zone labels and slot grids depend on the browser clock and zone. Each is empty or a placeholder until `useMounted()` is true. Check that the console shows no hydration warning on `/dashboard` and `/admin`.
2. **The booking's own slot in reschedule mode:** it's in `occupied` too, so `currentIso` must win. It shows "Current", not the strikethrough "You already have a booking" state. Nothing else on that day should be disabled because of it.
3. **Occupied-slot matching across offsets:** the API returns `+00:00` and the picker builds `Z` ISO strings, so compare by epoch ms, not by string. Covered in Task 1.
4. **A student with no bookings opens Book:** names are empty, nothing is disabled, and the whole-page empty state shows.
5. **Double submit:** the submit button is disabled while sending (`useApiAction` already guards against reruns), and the label shows "Booking…" or "Rescheduling…".

---

### Task 1: More display helpers (pure, tested)

**Files:**
- Modify: `lib/consultations/display.ts`, `lib/consultations/rules.ts` (copy constant only)
- Test: `tests/unit/display.test.ts`, `tests/unit/rules.test.ts`

**Interfaces (Produces):**
- `export function relativeTime(iso: string, now: Date): string`
- `export function timeZoneLabel(timeZone: string | undefined, at: Date): string`, giving e.g. `"Adelaide time (ACDT)"`. City is the last IANA segment with `_` turned into spaces; the abbreviation comes from `Intl.DateTimeFormat('en-AU', { timeZone, timeZoneName: 'short' })`. Fallback per call 6.
- `export type DayPeriod = 'Morning' | 'Afternoon' | 'Evening'`
- `export function slotPeriod(d: Date): DayPeriod`, using local `getHours()`: <12 is Morning, 12–16 is Afternoon, ≥17 is Evening.
- `export function groupSlotsByPeriod(slots: readonly Date[]): { period: DayPeriod; slots: Date[] }[]`, in Morning, Afternoon, Evening order, leaving out empty periods.
- `export function dayKey(d: Date): string`, giving local `yyyy-MM-dd`. Move it here from `slot-picker.tsx`.
- `export function initialDay(dayKeys: readonly string[], currentIso?: string): string | undefined`. Returns `dayKey(currentIso)` if it's in `dayKeys`, else `dayKeys[0]`.
- `export function activeSlotKeys(items: readonly Pick<Consultation,'status'|'scheduledAt'>[]): Set<number>`. Holds the epoch ms of the `scheduled` and `completed` rows.
- `export function prefillName(items: readonly Pick<Consultation,'firstName'|'lastName'|'createdAt'>[]): { firstName: string; lastName: string }`
- `export type RowAction = 'complete' | 'incomplete' | 'reschedule' | 'cancel'`
- `export function actionsFor(state: DisplayState): { visible: RowAction[]; menu: RowAction[] }`. The primary action is `visible[0]`.
- In `rules.ts`: `export const BOOKING_HELP`, built from `MIN_LEAD_HOURS / 24`, `MAX_AHEAD_DAYS`, `FIRST_START`, `LAST_START` and `BUSINESS_ZONE_LABEL`.

- [ ] **Step 1: Write the failing tests** (same `now = 2030-01-10T00:00:00Z` and helpers as the existing file):
  - `relativeTime`: +2 days gives `'in 2 days'`; +3 hours gives `'in 3 hours'`; −3 days gives `'3 days ago'`.
  - `timeZoneLabel('Australia/Adelaide', now)` gives `'Adelaide time (ACDT)'`; `('Australia/Melbourne', now)` gives `'Melbourne time (AEDT)'`; `('America/New_York', now)` starts with `'New York time ('`; `('Not/AZone', now)` gives `'Not/AZone'`; `(undefined, now)` gives `'your local time'`.
  - `slotPeriod`: `new Date(2030,0,10,11,45)` is Morning; `12,0` is Afternoon; `16,59` is Afternoon; `17,0` is Evening.
  - `groupSlotsByPeriod`: slots at local 9:00, 13:00 and 18:00, given out of order, come back grouped in period order; morning-only input gives one group.
  - `initialDay(['2030-01-11','2030-01-12'], <local 12 Jan iso>)` gives `'2030-01-12'`; an iso outside the list gives `'2030-01-11'`; `[]` gives `undefined`.
  - `activeSlotKeys`: scheduled and completed are included, cancelled is not, and `'2030-01-12T00:00:00+00:00'` and `'2030-01-12T00:00:00.000Z'` give the same key.
  - `prefillName`: picks the latest `createdAt` whatever the status; `[]` gives empty strings.
  - `actionsFor`: upcoming gives `{ visible: ['complete','reschedule','cancel'], menu: [] }`; needs_update gives `{ visible: ['complete','reschedule'], menu: ['cancel'] }`; completed gives `{ visible: ['incomplete'], menu: [] }`; cancelled gives empty for both.
  - `rules.test.ts`: `BOOKING_HELP === 'Book 1 to 14 days ahead, 8:00 am to 7:45 pm Melbourne time.'`
- [ ] **Step 2: Run** `npm run test:unit`. Expected: the new tests FAIL (missing exports).
- [ ] **Step 3: Implement** the interfaces above. `relativeTime` wraps `formatDistanceStrict(new Date(iso), now, { addSuffix: true })`. `timeZoneLabel` uses try/catch around `Intl`.
- [ ] **Step 4: Run** `npm run test:unit`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(consultations): add time, slot and row-action display helpers`.

### Task 2: Shared row pieces (§7 step 2)

**Files:**
- Modify: `components/consultations/status-badge.tsx`, `admin-consultation-table.tsx`, `consultation-row.tsx` (badge call site only), `app/(admin)/admin/page.tsx` (pass `now`)
- Create: `components/consultations/consultation-time.tsx`, `time-zone-note.tsx`, `complete-button.tsx`, `row-actions-menu.tsx`

**Interfaces (Produces):**
- `StatusBadge({ state }: { state: DisplayState })`, with label from `DISPLAY_STATE_LABEL`. Styles: upcoming is `secondary`. needs_update is `outline` + `border-amber-600/50 bg-amber-50 text-amber-900 dark:border-amber-400/50 dark:bg-amber-950 dark:text-amber-200`. completed is `outline` + `border-transparent bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200`. cancelled is `outline text-muted-foreground`.
- `ConsultationTime({ iso }: { iso: string })` (client). Renders `<time dateTime={iso}>` as two lines: `formatSlot` (font-medium), then `relativeTime(iso, new Date())` (`text-sm text-muted-foreground`). Both blank until mounted.
- `TimeZoneNote()` (client). Renders a lucide `Clock` icon (`aria-hidden`), then `Times in {timeZoneLabel(Intl.DateTimeFormat().resolvedOptions().timeZone, new Date())}` in `text-sm text-muted-foreground`. Blank until mounted.
- `CompleteButton({ item }: { item: Consultation })` (client). `Button variant="outline" size="sm"`; "Mark complete" when scheduled, "Mark incomplete" when completed; the accessible name includes the slot (`Mark consultation on {slot} complete` / `… incomplete`); same PATCH `{ completed }`; toasts "Marked complete" / "Marked incomplete".
- `RowActionsMenu({ slotLabel, children, className })` (client). `DropdownMenu` with a ghost icon `Button` (`MoreHorizontal` icon, `aria-label="More actions for consultation on {slotLabel}"`); `children` are `DropdownMenuItem`s.

- [ ] **Step 1:** Implement the four new components and the new `StatusBadge`. Update `consultation-row.tsx` and `admin-consultation-table.tsx` to pass `state={displayState(item, now)}`. The list and the admin page compute `now` once per request on the server (same `eslint-disable-next-line react-hooks/purity` pattern as `consultation-list.tsx`) and pass it down.
- [ ] **Step 2:** Run the checks. Expected: green.
- [ ] **Step 3: Browser:** on `/dashboard` as Alice, Chemistry reads "Past, not marked" in amber, and completed rows are green with their text labels. In the DevTools Rendering panel, emulate vision deficiency (achromatopsia): every badge is still readable by its text. `/admin` shows the same badges. No hydration warnings.
- [ ] **Step 4: Commit** `feat(consultations): display-state badges and shared row pieces`.

### Task 3: Student dashboard grouping and row anatomy (§7 step 3, §6.1)

**Files:**
- Modify: `components/consultations/consultation-list.tsx`, `consultation-row.tsx` (becomes client), `cancel-dialog.tsx` and `reschedule-dialog.tsx` (controlled: add optional `open`, `onOpenChange`, `trigger?: boolean` props; keep today's trigger when uncontrolled), `app/(student)/dashboard/page.tsx`
- Create: `components/consultations/cancelled-toggle.tsx`
- Delete: `components/consultations/status-toggle.tsx`

**Interfaces:**
- Consumes: `groupForStudent`, `actionsFor`, `StatusBadge`, `ConsultationTime`, `TimeZoneNote`, `CompleteButton`, `RowActionsMenu`.
- `ConsultationRow({ item, state, note }: { item: Consultation; state: DisplayState; note?: string })` (client). It holds `openDialog: 'reschedule' | 'cancel' | null` and renders the dialogs outside the menu.
- `CancelledToggle({ count, children })` (client): a ghost `Button` "Show cancelled ({count})" / "Hide cancelled", `aria-expanded`, collapsed by default.

- [ ] **Step 1:** Build the dashboard layout per §6.1:
  - The header holds the `h1`, `TimeZoneNote` and the "Book a consultation" button. It stays a `Link` to `/consultations/new` until Task 5.
  - Sections in order:
    - "Needs your update": only when non-empty; heading has a lucide `AlertTriangle` in `text-amber-600 dark:text-amber-400` with `aria-hidden`; each row's note is "Did this happen?".
    - "Upcoming": count `Badge`; empty state "Nothing booked yet" plus the book button.
    - "History": completed rows, then `CancelledToggle`; hidden when both lists are empty.
  - Whole-page empty state: a `Card` with "Book your first consultation", one line explaining what a consultation is, and the primary button.
- [ ] **Step 2:** Build the row:
  - Title: `reason`, `truncate`, with `title={reason}`. No name.
  - Second line: `ConsultationTime`, then the note if there is one.
  - Right side: the badge, then the actions from `actionsFor(state)`. `visible[0]` always shows. `visible.slice(1)` shows from `sm:` up and is also mirrored as `sm:hidden` menu items. `menu` items always go in ⋯, and the ⋯ button only renders when it has items at the current breakpoint.
  - Menu items "Reschedule" and "Cancel" set `openDialog`.
  - Cancelled rows: `bg-muted/40 text-muted-foreground`, no actions.
- [ ] **Step 3:** Run the checks. Expected: green. `grep -r StatusToggle components app` is empty.
- [ ] **Step 4: Browser (§6.1 criteria):**
  - Alice sees Needs your update (Chemistry); Upcoming (Methods, English); History (Specialist Maths, Term 3); "Show cancelled (1)".
  - No row shows "Alice Nguyen:".
  - Chemistry shows Mark complete and Reschedule, and ⋯ holds Cancel.
  - Mark Methods complete: the toast says "Marked complete", and Methods moves to History. Mark it incomplete again to restore it.
  - At a 375 px width, each row shows one action plus ⋯.
- [ ] **Step 5: Commit** `feat(dashboard): group consultations by display state`.

### Task 4: SlotPicker grid with occupied and current slots (§7 step 4)

**Files:**
- Modify: `components/consultations/slot-picker.tsx`

**Interfaces (Produces):** `SlotPicker({ value, onChange, now?, occupied?: Set<number>, currentIso?: string })`.
- Help line: `BOOKING_HELP`, then `<TimeZoneNote />`; the old "Times are shown in your local time" line goes.
- Day: the existing `Select`, with default `initialDay([...days.keys()], currentIso)`.
- Grid: `groupSlotsByPeriod(times)`, each group under a small heading. Buttons are `Button size="sm"`, `variant={selected ? 'default' : 'outline'}`, with `aria-pressed`.
- A slot equal to `currentIso` (by ms): disabled, label `{time} · Current`, `title="Your current time"`.
- A slot in `occupied`: disabled, `line-through`, `title="You already have a booking at this time"`.
- With no day chosen: "Choose a day first" in `text-sm text-muted-foreground`.

- [ ] **Step 1:** Implement it. Keep the `useMounted` placeholder.
- [ ] **Step 2:** Run the checks. Expected: green.
- [ ] **Step 3: Browser:** `/consultations/new` and the Reschedule dialog both show the grid. Slots fall under Morning, Afternoon and Evening. The selected slot is highlighted and `aria-pressed="true"` in the accessibility tree. Booking still works end to end.
- [ ] **Step 4: Commit** `feat(slot-picker): time grid with occupied and current slots`.

### Task 5: ConsultationDialog in both modes; redirect (§7 step 5, §6.2, §6.3)

**Files:**
- Create: `components/consultations/consultation-dialog.tsx`, `book-consultation-button.tsx`
- Modify: `consultation-row.tsx` (use the dialog in reschedule mode), `consultation-list.tsx`, `app/(student)/dashboard/page.tsx`, `app/(student)/consultations/new/page.tsx`, `use-api-action.ts`
- Delete: `booking-form.tsx`, `reschedule-dialog.tsx`

**Interfaces:**
- `ConsultationDialog(props)` (client). Either `{ mode: 'book'; open; onOpenChange; occupied: Set<number>; defaults: { firstName; lastName } }` or `{ mode: 'reschedule'; open; onOpenChange; occupied: Set<number>; item: Consultation }`.
  - **Book mode:** fields per §6.2. Reason `Textarea` has placeholder "Go over my Methods SAC practice questions", helper "What would you like help with?", and a counter `{n}/{max}` where `max = createConsultationSchema.shape.reason.maxLength`. The "When" `fieldset` holds `SlotPicker`. The submit button reads "Book consultation", then "Book for {formatSlot(slot)}", then "Booking…" while sending. Success: toast "Consultation booked", close the dialog, reset the form.
  - **Reschedule mode:** the title is "Reschedule consultation". The description is the reason (font-medium), then "Currently {formatSlot}". Only the "When" fieldset shows, with `currentIso=item.scheduledAt`. The submit button reads "Reschedule", then "Move to {slot}", then "Rescheduling…" while sending. Success toast: "Moved to {formatSlot(slot)}". The footer has a "Cancel" button (closes) on both modes.
- `useApiAction().run(request, successMessage, onSuccess?, opts?: { conflictHint?: string })`. On an `ApiClientError` with status 409 it shows `toast.error(message, { description: conflictHint })`. Reschedule passes "Refresh the page to see the latest."
- `BookConsultationButton({ openOnLoad, occupied, defaults, label? })` (client). It owns the dialog in book mode. If `openOnLoad` is set, it opens the dialog on mount and calls `router.replace('/dashboard')`. `occupied` is passed as `number[]` from the server and turned into a `Set` on the client.
- The dashboard page reads `searchParams.book === '1'`. It computes `activeSlotKeys(items)` and `prefillName(items)` and passes them to every book button: header, empty Upcoming, and the whole-page empty state.
- The `/consultations/new` page becomes `redirect('/dashboard?book=1')`.

- [ ] **Step 1:** Implement it. Reuse `Field`, `FieldError` and `errorProps` from `booking-form.tsx`, moved into `consultation-dialog.tsx`.
- [ ] **Step 2:** Run the checks. Expected: green. `grep -rE "BookingForm|RescheduleDialog" components app` is empty.
- [ ] **Step 3: Browser (§6.2 and §6.3 criteria):**
  - Visiting `/consultations/new` lands on `/dashboard` with the dialog open, and the URL has no `?book`.
  - Alice's names are pre-filled.
  - English's slot is disabled, and nothing else is blocked by the cancelled row.
  - Forcing a duplicate with `fetch('/api/consultations', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...English's slot… }) })` in the console returns 409 "That time slot is already booked".
  - Rescheduling Methods changes its time on the same row, with no new or cancelled row.
  - Chemistry (past) can be rescheduled into the window.
- [ ] **Step 4: Commit** `feat(consultations): shared book and reschedule dialog; redirect /consultations/new`.

### Task 6: Cancel from the ⋯ menu (§7 step 6, §6.4)

**Files:**
- Modify: `components/consultations/cancel-dialog.tsx`, `row-actions-menu.tsx`, `consultation-row.tsx` (as needed)

- [ ] **Step 1:** Make the handover clean. The menu item's `onSelect` sets `openDialog` after the menu closes. Add `onCloseAutoFocus={(e) => e.preventDefault()}` on `DropdownMenuContent` when a dialog is opening, so focus isn't pulled back to ⋯. `AlertDialogContent` puts first focus on "Keep it" (Radix's default for `AlertDialogCancel`; make it explicit with `onOpenAutoFocus` if the check fails). The copy stays the same.
- [ ] **Step 2:** Run the checks. Expected: green.
- [ ] **Step 3: Browser:** using the keyboard only, Tab to Chemistry's ⋯, press Enter, choose Cancel. The menu closes, the dialog opens, and `document.activeElement` is "Keep it". Escape keeps the booking. Repeat and confirm: the toast says "Consultation cancelled" and the row moves to the cancelled list. Afterwards, `npm run db:reset` restores the seed.
- [ ] **Step 4: Commit** `fix(consultations): cancel from the row menu with correct focus`.

### Task 7: Admin list (§7 step 7, §6.5)

**Files:**
- Modify: `components/consultations/admin-consultation-table.tsx`, `app/(admin)/admin/page.tsx`

- [ ] **Step 1:**
  - Header: `h1` "All consultations", a `Badge variant="secondary"` "Admin", and a muted "Read-only" label with a lucide `Lock` (`aria-hidden`). `TimeZoneNote` goes under it.
  - Columns in order: Time (`ConsultationTime`); Student (name, then muted email); Reason (truncated with `title`); Status (`StatusBadge`).
  - Row classes: needs_update gets `bg-amber-50/60 dark:bg-amber-950/40`; cancelled gets `text-muted-foreground`.
  - Pagination footer: `Button asChild variant="outline" size="sm"` around `Link`s, "First page" (only with a cursor) and "Next page" (only with `nextCursor`), inside `nav aria-label="Pagination"`.
  - The empty state and the invalid-cursor message stay the same.
- [ ] **Step 2:** Run the checks. Expected: green.
- [ ] **Step 3: Browser (§6.5 criteria):** Chemistry shows "Past, not marked" on a highlighted row. `/admin?cursor=<nextCursor>` works if there's a second page (temporarily lower `PAGE_SIZE` locally to check it, then revert). `/admin?cursor=garbage` shows "Invalid page link."
- [ ] **Step 4: Commit** `feat(admin): display-state badges, student column, pagination buttons`.

### Task 8: Seed reason fix and full walkthrough (§7 step 8, D7)

**Files:**
- Modify: `scripts/seed.ts:70`, changing the reason `'Rescheduled: Physics projectile motion'` to `'Physics projectile motion'`. The slot and status stay.

- [ ] **Step 1:** Edit it, then run `npm run db:reset`. Expected: the seed completes.
- [ ] **Step 2:** Walk through every acceptance criterion in §6.1–§6.5 as Alice, then do the dashboard checks as Bob (Bob sees no Needs your update section, since his past bookings are completed or cancelled, and his own History). Then do the admin checks. Record each criterion as pass or fail in the commit body.
- [ ] **Step 3:** Run the checks. Expected: green.
- [ ] **Step 4: Commit** `fix(seed): drop misleading "Rescheduled:" prefix (D7)`.

### Task 9: Docs (§7 step 9)

**Files:**
- Modify: `docs/superpowers/specs/2026-11-22-mini-lms-design.md` §10 and §17 ("Upcoming vs past" now points to the refresh spec), `README.md`

- [ ] **Step 1:** At the top of §10, add a pointer saying the refresh spec supersedes it. Amend the §17 "Upcoming vs past" bullet to say it's superseded by D2.
- [ ] **Step 2:** Add a README section "UI decisions" covering D1 to D6, one line each. Add one line under the admin notes that pagination shows no total count because keyset pagination doesn't produce one cheaply.
- [ ] **Step 3:** In `README.md` §8, remove "Move keyboard focus to a sensible element after a cancel dialog closes" only if Task 6 fixed it. Keep "End-to-end browser tests".
- [ ] **Step 4: Commit** `docs: point to UI refresh spec; add UI decisions to README`.

## Verification (whole branch)

- `npm run lint`, `npm run typecheck` and `npm test` pass on the final commit.
- Every acceptance criterion in §6.1–§6.5 is ticked in the Task 8 walkthrough.
- `git diff master --stat -- app/api lib/consultations/service.ts lib/consultations/schema.ts supabase/` is empty.
- `grep -rnE "#[0-9a-fA-F]{3,6}\b" components/consultations app` finds nothing new.
