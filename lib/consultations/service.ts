import { createAdminClient } from '@/lib/supabase/admin'
import { errors, mapDbError } from '@/lib/api/http'
import { isSlotAligned, isWithinBookingWindow, type ConsultationStatus } from './rules'
import { encodeCursor, type CreateConsultationInput, type Cursor } from './schema'

export type Consultation = {
  id: string
  firstName: string
  lastName: string
  reason: string
  scheduledAt: string
  status: ConsultationStatus
  createdAt: string
  updatedAt: string
}
export type AdminConsultation = Consultation & { email: string }

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

const WINDOW_MSG = 'Consultations must be booked between 24 hours and 14 days ahead'

function assertBookable(scheduledAt: string, now: Date): string {
  const d = new Date(scheduledAt)
  if (Number.isNaN(d.getTime())) throw errors.validation('Invalid date')
  if (!isSlotAligned(d)) throw errors.validation('Consultations must start on a 15-minute boundary')
  if (!isWithinBookingWindow(d, now)) throw errors.validation(WINDOW_MSG)
  return d.toISOString()
}

export async function listOwn(userId: string): Promise<Consultation[]> {
  const { data, error } = await createAdminClient()
    .from('consultations')
    .select(COLUMNS)
    .eq('user_id', userId)
    .order('scheduled_at', { ascending: true })
  if (error) throw mapDbError(error)
  return (data ?? []).map(toConsultation)
}

export async function book(userId: string, input: CreateConsultationInput, now: Date = new Date()): Promise<Consultation> {
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
// read the row once to decide between not found / conflict / idempotent no-op.
async function transition(userId: string, id: string, change: Change, noopStatus?: ConsultationStatus): Promise<Consultation> {
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
  if (noopStatus && row.status === noopStatus) return toConsultation(row)
  throw errors.conflict('Only scheduled consultations can be rescheduled or cancelled')
}

export async function reschedule(userId: string, id: string, scheduledAt: string, now: Date = new Date()): Promise<Consultation> {
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

export async function listAll(q: { cursor?: Cursor; limit: number }): Promise<{ items: AdminConsultation[]; nextCursor: string | null }> {
  let query = createAdminClient()
    .from('consultations')
    .select(`${COLUMNS}, profiles(email)`)
    .order('scheduled_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(q.limit + 1)

  if (q.cursor) {
    // Safe to interpolate: both values are re-serialised from strictly validated data
    // (ISO datetime via Date#toISOString, uuid validated by z.uuid()), never raw input
    // (spec 8a, rule 1). This is the only .or() in the codebase.
    const iso = new Date(q.cursor.scheduledAt).toISOString()
    const uuid = q.cursor.id
    query = query.or(`scheduled_at.gt."${iso}",and(scheduled_at.eq."${iso}",id.gt.${uuid})`)
  }

  const { data, error } = await query
  if (error) throw mapDbError(error)
  const rows = data ?? []
  const page = rows.slice(0, q.limit)
  const items: AdminConsultation[] = page.map((row) => {
    const p = (row as { profiles?: { email: string } | { email: string }[] | null }).profiles
    const email = (Array.isArray(p) ? p[0]?.email : p?.email) ?? ''
    return { ...toConsultation(row), email }
  })
  const last = page[page.length - 1]
  const nextCursor =
    rows.length > q.limit && last
      ? encodeCursor({ scheduledAt: new Date(last.scheduled_at).toISOString(), id: last.id })
      : null
  return { items, nextCursor }
}
