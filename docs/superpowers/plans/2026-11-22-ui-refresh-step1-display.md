# UI refresh step 1: display state model, implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add pure functions in `lib/consultations/display.ts` that turn a consultation into its display state and group a student's list into the dashboard sections, with unit tests.

**Architecture:** One new pure module with no React and no server imports, and one new vitest unit file. Nothing existing changes. Later steps (StatusBadge, dashboard, admin) import from it.

**Tech Stack:** TypeScript, vitest (`unit` project, `tests/unit/**/*.test.ts`).

**Spec:** `docs/superpowers/specs/2026-11-22-ui-ux-refresh.md` §4, §5, §6.1 (sort orders), §7 step 1.

**Approved short design (from the conversation):** the rules come from §4. Sort orders: upcoming soonest first; needs update, completed and cancelled newest first, all by `scheduledAt`. The seed's Specialist Maths row, completed and in the future, has to sit above Term 3. Ties are broken by `id`. A label map for badge text is included; badge styling waits for step 2. Work goes on branch `ui-refresh`. After plan mode ends, this plan is copied to `docs/superpowers/plans/2026-11-22-ui-refresh-step1-display.md`.

## Global Constraints

- No business rules in components; display logic lives in `lib/consultations/display.ts` as pure functions with unit tests.
- Never change API contracts, service rules or migrations.
- `display.ts` must be safe to import from client components: type-only import from `@/lib/consultations/service` (`import type`), and nothing else from server modules.
- Badge labels, verbatim: `upcoming` → "Scheduled", `needs_update` → "Past, not marked", `completed` → "Completed", `cancelled` → "Cancelled".

## Review Focus

1. `scheduledAt === now` counts as `upcoming` (spec boundary). Test: `displayState` boundary case.
2. ISO strings with different offsets (`...Z` vs `...+10:00`) must sort by instant, not by string. Test: `groupForStudent sorts by instant across offsets`.
3. A `completed` row booked in the future goes to History, not Upcoming (seed Specialist Maths). Test: the Alice fixture.
4. `groupForStudent` must not mutate or reorder the caller's array (React state is passed in). Test: `does not mutate input`.
5. Two rows with the same `scheduledAt` (seed: the cancelled row shares English's slot) come out in a stable order. Test: the tie-break by `id`.

---

### Task 0: Branch and docs commit

- [ ] `git switch -c ui-refresh`
- [ ] `git add CLAUDE.md docs/superpowers/specs/2026-11-22-ui-ux-refresh.md docs/superpowers/plans/2026-11-22-ui-refresh-step1-display.md`
- [ ] `git commit -m "docs: add UI/UX refresh spec, CLAUDE.md UI rules, step 1 plan"`. Expected: `git status` shows a clean tree.

**Execution:** native (I implement it in this session). It's one small task with no interfaces between tasks, so a review per task adds nothing. I'll run one review of the branch at the end.

### Task 1: `display.ts` with tests

**Files:**
- Create: `lib/consultations/display.ts`
- Test: `tests/unit/display.test.ts`

**Interfaces:**
- Consumes: `type Consultation` from `@/lib/consultations/service` (fields used: `id`, `status`, `scheduledAt` ISO string).
- Produces:
  - `export type DisplayState = 'upcoming' | 'needs_update' | 'completed' | 'cancelled'`
  - `export const DISPLAY_STATE_LABEL: Record<DisplayState, string>`
  - `export function displayState(item: Pick<Consultation, 'status' | 'scheduledAt'>, now: Date): DisplayState`
  - `export type StudentGroups<T> = { needsUpdate: T[]; upcoming: T[]; history: { completed: T[]; cancelled: T[] } }`
  - `export function groupForStudent<T extends Pick<Consultation, 'id' | 'status' | 'scheduledAt'>>(items: readonly T[], now: Date): StudentGroups<T>`

- [ ] **Step 1: Write the failing tests** in `tests/unit/display.test.ts`, following the style of `rules.test.ts`, with a fixed `now = new Date('2030-01-10T00:00:00Z')` and a helper `c(id, status, scheduledAt)` that builds a minimal item.
  - `displayState`: scheduled +1 min → `'upcoming'`; scheduled at exactly `now.toISOString()` → `'upcoming'`; scheduled −1 min → `'needs_update'`; completed in the past and in the future → `'completed'`; cancelled in the past and in the future → `'cancelled'`.
  - `DISPLAY_STATE_LABEL` equals the four labels in Global Constraints.
  - `groupForStudent` Alice fixture, mirroring `scripts/seed.ts:65-70` as offsets from `now`: Methods +2d scheduled, English +5d scheduled, Chemistry −3d scheduled, Term 3 −7d completed, Specialist +4d completed, Physics +5d cancelled (same instant as English). Expect ids: `needsUpdate` `[chem]`, `upcoming` `[methods, english]`, `history.completed` `[specialist, term3]`, `history.cancelled` `[physics]`.
  - Orders: upcoming ascending; needsUpdate, completed and cancelled descending (each with 2+ rows).
  - Tie: two cancelled rows at the same instant, ids `'b'` and `'a'` → `['a', 'b']`.
  - Offsets: two upcoming rows `'2030-01-12T09:00:00+10:00'` (23:00Z on the 11th) and `'2030-01-11T23:30:00Z'` → the `+10:00` one first.
  - Empty input → all four arrays empty.
  - Does not mutate input: freeze a copy of the input order, call, and assert the input is unchanged.

- [ ] **Step 2: Run** `npx vitest run --project unit tests/unit/display.test.ts`. Expected: FAIL, the module can't be resolved.

- [ ] **Step 3: Implement** `lib/consultations/display.ts` with the interfaces above. Compare times with `Date.parse(item.scheduledAt)` against `now.getTime()`; the comparison is `>=` for upcoming. Sort copies with a comparator on the parsed instant, then `id.localeCompare`. Add one short comment saying a past `scheduled` row stays cancellable in the API (D1), so this is display-only.

- [ ] **Step 4: Run** `npx vitest run --project unit tests/unit/display.test.ts`. Expected: all PASS.

- [ ] **Step 5: Full checks:** `npm run lint`, `npm run typecheck`, `npm test`. Expected: all green. If integration tests fail only because the local Supabase isn't running, report that rather than calling it a pass. Run `npm run test:unit` as well and report both.

- [ ] **Step 6: Commit**
```bash
git add lib/consultations/display.ts tests/unit/display.test.ts
git commit -m "feat(consultations): add display state and student grouping helpers"
```

## Verification

- Step 1 has no page to open (no UI changes). The spec's "open the page" check starts at step 2.
- The criteria for step 1 in §5 are met by these tests: the boundary `scheduledAt === now`, the sort orders from §6.1, and an Alice fixture that matches the dashboard criteria in §6.1 (Needs your update: Chemistry; Upcoming: Methods, English; History: Specialist Maths, Term 3; one cancelled row).
- `git diff master --stat` shows only the docs files, `display.ts` and `display.test.ts`.
