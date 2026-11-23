import { createAdminClient } from '@/lib/supabase/admin'
import { errors, mapDbError } from '@/lib/api/http'
import {
  HOURS_MESSAGE,
  WINDOW_MESSAGE,
  isSlotAligned,
  isWithinBookingWindow,
  isWithinBusinessHours,
  type ConsultationStatus,
} from './rules'
import { STUDENT_GROUPS, encodeCursor, type CreateConsultationInput, type Cursor, type StudentGroup } from './schema'
import type { AdminConsultation, Consultation, Page, StudentName } from './types'

export type { AdminConsultation, Consultation, Page, StudentName } from './types'

const COLUMNS = 'id, user_id, first_name, last_name, reason, scheduled_at, status, created_at, updated_at'

type Row = {
  id: string
  first_name: string
  last_name: string
  reason: string
  scheduled_at: string
  status: string
  created_at: string
  updated_at: string
}

function toConsultation(row: Row): Consultation {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    reason: row.reason,
    scheduledAt: row.scheduled_at,
    status: row.status as ConsultationStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function assertBookable(scheduledAt: string, now: Date): string {
  const d = new Date(scheduledAt)
  if (Number.isNaN(d.getTime())) throw errors.validation('Invalid date')
  if (!isSlotAligned(d)) throw errors.validation('Consultations must start on a 15-minute boundary')
  if (!isWithinBookingWindow(d, now)) throw errors.validation(WINDOW_MESSAGE)
  if (!isWithinBusinessHours(d)) throw errors.validation(HOURS_MESSAGE)
  return d.toISOString()
}

/** The name saved on the student's account at sign-up; pre-fills the booking form. Empty if none. */
export async function getProfileName(userId: string): Promise<StudentName> {
  const { data, error } = await createAdminClient()
    .from('profiles')
    .select('first_name, last_name')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw mapDbError(error)
  return { firstName: data?.first_name ?? '', lastName: data?.last_name ?? '' }
}

/**
 * Keyset condition for the rows after `cursor` in (scheduled_at, id) order.
 * Safe to interpolate: both values are re-serialised from strictly validated data
 * (ISO datetime via Date#toISOString, uuid validated by z.uuid()), never raw input
 * (spec 8a, rule 1). This is the only .or() filter in the codebase; every list uses it.
 */
function afterCursor(cursor: Cursor, newestFirst: boolean): string {
  const iso = new Date(cursor.scheduledAt).toISOString()
  const op = newestFirst ? 'lt' : 'gt'
  return `scheduled_at.${op}."${iso}",and(scheduled_at.eq."${iso}",id.${op}.${cursor.id})`
}

function nextCursorOf(rows: { scheduled_at: string; id: string }[], limit: number): string | null {
  const last = rows[limit - 1]
  return rows.length > limit && last
    ? encodeCursor({ scheduledAt: new Date(last.scheduled_at).toISOString(), id: last.id })
    : null
}

type Filterable<Q> = { eq(c: string, v: string): Q; gte(c: string, v: string): Q; lt(c: string, v: string): Q }

/**
 * Narrows a query to one group, for one student or (no userId) everyone. The groups match
 * displayState in display.ts: scheduled splits at `now` into upcoming and needs_update;
 * completed and cancelled ignore the time. Pages and counts both use it, so they agree.
 */
function inGroup<Q extends Filterable<Q>>(query: Q, group: StudentGroup, now: Date, userId?: string): Q {
  const scoped = userId ? query.eq('user_id', userId) : query
  const nowIso = now.toISOString()
  if (group === 'upcoming') return scoped.eq('status', 'scheduled').gte('scheduled_at', nowIso)
  if (group === 'needs_update') return scoped.eq('status', 'scheduled').lt('scheduled_at', nowIso)
  return scoped.eq('status', group)
}

/** Upcoming is soonest first; every other group is most recent first. */
const newestFirst = (group: StudentGroup) => group !== 'upcoming'

async function countGroup(group: StudentGroup, now: Date, userId?: string): Promise<number> {
  const query = createAdminClient().from('consultations').select('id', { count: 'exact', head: true })
  const { count, error } = await inGroup(query, group, now, userId)
  if (error) throw mapDbError(error)
  return count ?? 0
}

/** How many bookings are in each group, for one student or everyone: the tab and section counts. */
export async function countGroups(
  scope: { userId?: string },
  now: Date = new Date(),
): Promise<Record<StudentGroup, number>> {
  const counts = await Promise.all(STUDENT_GROUPS.map((g) => countGroup(g, now, scope.userId)))
  return Object.fromEntries(STUDENT_GROUPS.map((g, i) => [g, counts[i]])) as Record<StudentGroup, number>
}

/** One page of one dashboard section, with `total` for the whole section. */
export async function listOwnGroup(
  userId: string,
  q: { group: StudentGroup; cursor?: Cursor; limit: number },
  now: Date = new Date(),
): Promise<Page<Consultation>> {
  const desc = newestFirst(q.group)
  let page = inGroup(createAdminClient().from('consultations').select(COLUMNS), q.group, now, userId)
    .order('scheduled_at', { ascending: !desc })
    .order('id', { ascending: !desc })
    .limit(q.limit + 1)
  if (q.cursor) page = page.or(afterCursor(q.cursor, desc))

  const [rows, total] = await Promise.all([page, countGroup(q.group, now, userId)])
  if (rows.error) throw mapDbError(rows.error)
  const data = rows.data ?? []
  return { items: data.slice(0, q.limit).map(toConsultation), nextCursor: nextCursorOf(data, q.limit), total }
}

/** One page of one group across all students (the admin tabs), with the account email and the group total. */
export async function listAllGroup(
  q: { group: StudentGroup; cursor?: Cursor; limit: number },
  now: Date = new Date(),
): Promise<Page<AdminConsultation>> {
  const desc = newestFirst(q.group)
  let page = inGroup(createAdminClient().from('consultations').select(`${COLUMNS}, profiles(email)`), q.group, now)
    .order('scheduled_at', { ascending: !desc })
    .order('id', { ascending: !desc })
    .limit(q.limit + 1)
  if (q.cursor) page = page.or(afterCursor(q.cursor, desc))

  const [rows, total] = await Promise.all([page, countGroup(q.group, now)])
  if (rows.error) throw mapDbError(rows.error)
  const data = rows.data ?? []
  return {
    items: data.slice(0, q.limit).map((row) => ({ ...toConsultation(row), email: row.profiles?.email ?? '' })),
    nextCursor: nextCursorOf(data, q.limit),
    total,
  }
}

/**
 * Epoch ms of the student's future slots that are taken (scheduled or completed), so
 * the slot picker can mark them. Bounded: bookings are at most 14 days ahead.
 */
export async function listActiveSlots(userId: string, now: Date = new Date()): Promise<number[]> {
  const { data, error } = await createAdminClient()
    .from('consultations')
    .select('scheduled_at')
    .eq('user_id', userId)
    .neq('status', 'cancelled')
    .gte('scheduled_at', now.toISOString())
  if (error) throw mapDbError(error)
  return (data ?? []).map((r) => Date.parse(r.scheduled_at))
}

export async function book(
  userId: string,
  input: CreateConsultationInput,
  now: Date = new Date(),
): Promise<Consultation> {
  const iso = assertBookable(input.scheduledAt, now)
  const { data, error } = await createAdminClient()
    .from('consultations')
    .insert({
      user_id: userId,
      first_name: input.firstName,
      last_name: input.lastName,
      reason: input.reason,
      scheduled_at: iso,
    })
    .select(COLUMNS)
    .single()
  if (error) throw mapDbError(error)
  return toConsultation(data)
}

type Change = {
  from: ConsultationStatus
  patch: { status?: ConsultationStatus; scheduled_at?: string }
}

// One conditional update scoped by id, owner and source status. If nothing changed,
// read the row once to decide between not found / conflict / idempotent no-op
// (the row is already in `alreadyDoneStatus`, e.g. marking a completed booking complete).
async function transition(
  userId: string,
  id: string,
  change: Change,
  alreadyDoneStatus?: ConsultationStatus,
): Promise<Consultation> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('consultations')
    .update(change.patch)
    .eq('id', id)
    .eq('user_id', userId)
    .eq('status', change.from)
    .select(COLUMNS)
    .maybeSingle()
  if (error) throw mapDbError(error)
  if (data) return toConsultation(data)

  const { data: row, error: readError } = await db
    .from('consultations')
    .select(COLUMNS)
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()
  if (readError) throw mapDbError(readError)
  if (!row) throw errors.notFound()
  if (row.status === 'cancelled') throw errors.conflict('Cancelled consultations cannot be changed')
  if (alreadyDoneStatus && row.status === alreadyDoneStatus) return toConsultation(row)
  throw errors.conflict('Only scheduled consultations can be rescheduled or cancelled')
}

export async function reschedule(
  userId: string,
  id: string,
  scheduledAt: string,
  now: Date = new Date(),
): Promise<Consultation> {
  const iso = assertBookable(scheduledAt, now)
  return transition(userId, id, { from: 'scheduled', patch: { scheduled_at: iso } })
}

export async function setCompleted(userId: string, id: string, completed: boolean): Promise<Consultation> {
  const to: ConsultationStatus = completed ? 'completed' : 'scheduled'
  const from: ConsultationStatus = completed ? 'scheduled' : 'completed'
  return transition(userId, id, { from, patch: { status: to } }, to)
}

export async function cancel(userId: string, id: string): Promise<Consultation> {
  return transition(userId, id, { from: 'scheduled', patch: { status: 'cancelled' } })
}

export async function listAll(q: {
  cursor?: Cursor
  limit: number
}): Promise<{ items: AdminConsultation[]; nextCursor: string | null }> {
  let query = createAdminClient()
    .from('consultations')
    .select(`${COLUMNS}, profiles(email)`)
    .order('scheduled_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(q.limit + 1)

  if (q.cursor) query = query.or(afterCursor(q.cursor, false))

  const { data, error } = await query
  if (error) throw mapDbError(error)
  const rows = data ?? []
  const page = rows.slice(0, q.limit)
  const items: AdminConsultation[] = page.map((row) => {
    return { ...toConsultation(row), email: row.profiles?.email ?? '' }
  })
  return { items, nextCursor: nextCursorOf(rows, q.limit) }
}
