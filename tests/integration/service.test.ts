import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createAuthUser, deleteAuthUser, pgPool } from './helpers/db'
import { book, cancel, listAll, listOwn, reschedule, setCompleted } from '@/lib/consultations/service'

const HOUR = 3_600_000
const stamp = Date.now()
const now = new Date(Math.floor(Date.now() / HOUR) * HOUR)
const slot = (h: number) => new Date(now.getTime() + h * HOUR)
const input = (d: Date, reason = 'Help') => ({
  firstName: 'Ada',
  lastName: 'Lovelace',
  reason,
  scheduledAt: d.toISOString(),
})

let A: string
let B: string
let C: string
let D: string

beforeAll(async () => {
  A = await createAuthUser(`svc-a-${stamp}@example.com`)
  B = await createAuthUser(`svc-b-${stamp}@example.com`)
  C = await createAuthUser(`svc-c-${stamp}@example.com`)
  D = await createAuthUser(`svc-d-${stamp}@example.com`)
})

afterAll(async () => {
  for (const id of [A, B, C, D]) await deleteAuthUser(id)
  await pgPool.end()
})

describe('book', () => {
  it('books a valid slot', async () => {
    const c = await book(A, input(slot(48), 'Reason one'), now)
    expect(c.status).toBe('scheduled')
    expect(c.firstName).toBe('Ada')
    expect(c.lastName).toBe('Lovelace')
    expect(c.reason).toBe('Reason one')
    expect(new Date(c.scheduledAt).getTime()).toBe(slot(48).getTime())
  })

  it('rejects 15 minutes before the window opens', async () => {
    await expect(book(A, input(new Date(slot(24).getTime() - 15 * 60_000)), now)).rejects.toMatchObject({ code: 'validation' })
  })

  it('rejects 15 minutes after the window closes', async () => {
    await expect(book(A, input(new Date(slot(14 * 24).getTime() + 15 * 60_000)), now)).rejects.toMatchObject({ code: 'validation' })
  })

  it('rejects misaligned slots', async () => {
    await expect(book(A, input(new Date(slot(60).getTime() + 60_000)), now)).rejects.toMatchObject({ code: 'validation' })
  })

  it('accepts exactly now + 24h', async () => {
    await expect(book(A, input(slot(24)), now)).resolves.toMatchObject({ status: 'scheduled' })
  })

  it('parallel bookings of one slot: exactly one wins, other conflicts', async () => {
    const r = await Promise.allSettled([book(A, input(slot(72)), now), book(A, input(slot(72)), now)])
    expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1)
    const rej = r.find((x) => x.status === 'rejected') as PromiseRejectedResult
    expect(rej.reason).toMatchObject({ code: 'conflict' })
  })
})

describe('ownership', () => {
  it('scopes by user', async () => {
    const c = await book(A, input(slot(80)), now)
    expect((await listOwn(B)).map((x) => x.id)).not.toContain(c.id)
    expect((await listOwn(A)).map((x) => x.id)).toContain(c.id)
    await expect(reschedule(B, c.id, slot(81).toISOString(), now)).rejects.toMatchObject({ code: 'not_found' })
    await expect(cancel(B, c.id)).rejects.toMatchObject({ code: 'not_found' })
    await expect(setCompleted(B, c.id, true)).rejects.toMatchObject({ code: 'not_found' })
  })

  it('listOwn is ordered by scheduled_at asc', async () => {
    const list = await listOwn(A)
    const times = list.map((x) => new Date(x.scheduledAt).getTime())
    expect(times).toEqual([...times].sort((a, b) => a - b))
  })
})

describe('status changes', () => {
  it('complete / idempotent / uncomplete', async () => {
    const c = await book(B, input(slot(90)), now)
    expect((await setCompleted(B, c.id, true)).status).toBe('completed')
    expect((await setCompleted(B, c.id, true)).status).toBe('completed')
    expect((await setCompleted(B, c.id, false)).status).toBe('scheduled')
  })

  it('cancelled bookings are frozen', async () => {
    const c = await book(B, input(slot(100)), now)
    expect((await cancel(B, c.id)).status).toBe('cancelled')
    await expect(cancel(B, c.id)).rejects.toMatchObject({ code: 'conflict' })
    await expect(reschedule(B, c.id, slot(101).toISOString(), now)).rejects.toMatchObject({ code: 'conflict' })
    await expect(setCompleted(B, c.id, true)).rejects.toMatchObject({ code: 'conflict' })
  })

  it('cannot reschedule a completed booking', async () => {
    const c = await book(B, input(slot(110)), now)
    await setCompleted(B, c.id, true)
    await expect(reschedule(B, c.id, slot(111).toISOString(), now)).rejects.toMatchObject({ code: 'conflict' })
  })

  it('cannot reschedule into own completed slot', async () => {
    const s = await book(B, input(slot(120)), now)
    await setCompleted(B, s.id, true)
    const t = await book(B, input(slot(121)), now)
    await expect(reschedule(B, t.id, slot(120).toISOString(), now)).rejects.toMatchObject({ code: 'conflict' })
  })

  it('reschedules to a new slot', async () => {
    const c = await book(B, input(slot(130)), now)
    const r = await reschedule(B, c.id, slot(131).toISOString(), now)
    expect(new Date(r.scheduledAt).getTime()).toBe(slot(131).getTime())
  })

  it('reschedule enforces window and alignment', async () => {
    const c = await book(B, input(slot(140)), now)
    await expect(reschedule(B, c.id, slot(1).toISOString(), now)).rejects.toMatchObject({ code: 'validation' })
    await expect(reschedule(B, c.id, new Date(slot(141).getTime() + 1000).toISOString(), now)).rejects.toMatchObject({ code: 'validation' })
  })
})

describe('listAll', () => {
  it('includes cancelled rows and email', async () => {
    const c = await book(C, input(slot(150)), now)
    await cancel(C, c.id)
    const { items } = await listAll({
      cursor: { scheduledAt: new Date(slot(150).getTime() - 1).toISOString(), id: '00000000-0000-0000-0000-000000000000' },
      limit: 100,
    })
    const mine = items.find((x) => x.id === c.id)
    expect(mine?.status).toBe('cancelled')
    expect(mine?.email).toBe(`svc-c-${stamp}@example.com`)
  })

  it('pages ties on scheduled_at without skipping or repeating', async () => {
    // Slot near the window end; cursor sits 1ms before it so earlier data is skipped.
    const s = slot(14 * 24 - 1)
    const ids = [
      (await book(A, input(s), now)).id,
      (await book(C, input(s), now)).id,
      (await book(D, input(s), now)).id,
    ]
    const cursor = { scheduledAt: new Date(s.getTime() - 1).toISOString(), id: '00000000-0000-0000-0000-000000000000' }
    const p1 = await listAll({ cursor, limit: 2 })
    expect(p1.items).toHaveLength(2)
    expect(p1.nextCursor).not.toBeNull()
    const { decodeCursor } = await import('@/lib/consultations/schema')
    const p2 = await listAll({ cursor: decodeCursor(p1.nextCursor!)!, limit: 2 })
    const seen = [...p1.items, ...p2.items].map((x) => x.id)
    expect(new Set(seen).size).toBe(seen.length)
    for (const id of ids) expect(seen).toContain(id)
    expect(p1.items.every((x) => ids.includes(x.id))).toBe(true)
    expect(p2.items[0].id).toBe(ids.filter((i) => !p1.items.some((x) => x.id === i))[0])
    expect(p2.items.length).toBeGreaterThanOrEqual(1)
  })
})
