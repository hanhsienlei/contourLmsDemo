import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createAuthUser, deleteAuthUser, pgPool } from './helpers/db'
import {
  book,
  cancel,
  getProfileName,
  listActiveSlots,
  listAll,
  listOwnGroup,
  reschedule,
  setCompleted,
} from '@/lib/consultations/service'
import { decodeCursor } from '@/lib/consultations/schema'

const HOUR = 3_600_000
const stamp = Date.now()
// Fixed Monday 9:00 am in Melbourne (AEDT). No DST change in the next 14 days,
// so slot(h) lands on business hours whenever (9 + h) % 24 is between 8 and 19.
const now = new Date('2030-11-04T09:00:00+11:00')
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

describe('getProfileName', () => {
  it("returns the account's sign-up name", async () => {
    const id = await createAuthUser(`svc-n-${stamp}@example.com`, undefined, {
      first_name: 'Ada',
      last_name: 'Lovelace',
    })
    try {
      expect(await getProfileName(id)).toEqual({ firstName: 'Ada', lastName: 'Lovelace' })
    } finally {
      await deleteAuthUser(id)
    }
  })

  it('returns empty strings when the account has no name', async () => {
    expect(await getProfileName(A)).toEqual({ firstName: '', lastName: '' })
  })

  it('returns empty strings for an unknown user', async () => {
    expect(await getProfileName(crypto.randomUUID())).toEqual({ firstName: '', lastName: '' })
  })
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
    await expect(book(A, input(new Date(slot(24).getTime() - 15 * 60_000)), now)).rejects.toMatchObject({
      code: 'validation',
    })
  })

  it('rejects 15 minutes after the window closes', async () => {
    await expect(book(A, input(new Date(slot(14 * 24).getTime() + 15 * 60_000)), now)).rejects.toMatchObject({
      code: 'validation',
    })
  })

  it('rejects misaligned slots', async () => {
    await expect(book(A, input(new Date(slot(60).getTime() + 60_000)), now)).rejects.toMatchObject({
      code: 'validation',
    })
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
    const upcoming = (user: string) => listOwnGroup(user, { group: 'upcoming', limit: 100 }, now)
    expect((await upcoming(B)).items.map((x) => x.id)).not.toContain(c.id)
    expect((await upcoming(A)).items.map((x) => x.id)).toContain(c.id)
    await expect(reschedule(B, c.id, slot(81).toISOString(), now)).rejects.toMatchObject({ code: 'not_found' })
    await expect(cancel(B, c.id)).rejects.toMatchObject({ code: 'not_found' })
    await expect(setCompleted(B, c.id, true)).rejects.toMatchObject({ code: 'not_found' })
  })
})

describe('status changes', () => {
  it('complete / idempotent / uncomplete', async () => {
    const c = await book(B, input(slot(96)), now)
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
    const c = await book(B, input(slot(104)), now)
    await setCompleted(B, c.id, true)
    await expect(reschedule(B, c.id, slot(105).toISOString(), now)).rejects.toMatchObject({ code: 'conflict' })
  })

  it('cannot reschedule into own completed slot', async () => {
    const s = await book(B, input(slot(120)), now)
    await setCompleted(B, s.id, true)
    const t = await book(B, input(slot(121)), now)
    await expect(reschedule(B, t.id, slot(120).toISOString(), now)).rejects.toMatchObject({ code: 'conflict' })
  })

  it('reschedules to a new slot', async () => {
    const c = await book(B, input(slot(130)), now)
    const r = await reschedule(B, c.id, slot(129).toISOString(), now)
    expect(new Date(r.scheduledAt).getTime()).toBe(slot(129).getTime())
  })

  it('reschedule enforces window and alignment', async () => {
    const c = await book(B, input(slot(144)), now)
    await expect(reschedule(B, c.id, slot(1).toISOString(), now)).rejects.toMatchObject({ code: 'validation' })
    await expect(reschedule(B, c.id, new Date(slot(145).getTime() + 1000).toISOString(), now)).rejects.toMatchObject({
      code: 'validation',
    })
  })

  it('book and reschedule enforce Melbourne business hours', async () => {
    // slot(40) is 1:00 am, slot(35) is 8:00 pm (closing): both outside hours.
    await expect(book(B, input(slot(40)), now)).rejects.toMatchObject({ code: 'validation' })
    await expect(book(B, input(slot(35)), now)).rejects.toMatchObject({ code: 'validation' })
    const c = await book(B, input(slot(34)), now) // 7:00 pm is fine
    await expect(reschedule(B, c.id, slot(40).toISOString(), now)).rejects.toMatchObject({
      code: 'validation',
      message: 'Consultations start between 8:00 am and 7:45 pm Melbourne time',
    })
  })
})

describe('listAll', () => {
  it('includes cancelled rows and email', async () => {
    const c = await book(C, input(slot(150)), now)
    await cancel(C, c.id)
    const { items } = await listAll({
      cursor: {
        scheduledAt: new Date(slot(150).getTime() - 1).toISOString(),
        id: '00000000-0000-0000-0000-000000000000',
      },
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

describe('listOwnGroup', () => {
  // E's bookings, made at `now`: two stay scheduled, one completed, two cancelled.
  let E: string
  const ids: Record<string, string> = {}

  beforeAll(async () => {
    E = await createAuthUser(`svc-e-${stamp}@example.com`)
    for (const [key, h] of [
      ['s1', 26],
      ['s2', 50],
      ['s3', 74],
      ['done', 98],
      ['x1', 27],
      ['x2', 51],
    ] as const) {
      ids[key] = (await book(E, input(slot(h), key), now)).id
    }
    await setCompleted(E, ids.done, true)
    await cancel(E, ids.x1)
    await cancel(E, ids.x2)
  })

  afterAll(async () => {
    await deleteAuthUser(E)
  })

  const all = async (group: Parameters<typeof listOwnGroup>[1]['group'], at: Date, limit = 2) => {
    const seen: string[] = []
    let cursor
    let pages = 0
    let total = -1
    do {
      const page = await listOwnGroup(E, { group, cursor, limit }, at)
      seen.push(...page.items.map((x) => x.reason))
      total = page.total
      cursor = page.nextCursor ? decodeCursor(page.nextCursor)! : undefined
      pages++
    } while (cursor)
    return { seen, total, pages }
  }

  it('pages through upcoming soonest first, with the group total on every page', async () => {
    expect(await all('upcoming', now)).toEqual({ seen: ['s1', 's2', 's3'], total: 3, pages: 2 })
  })

  it('splits scheduled bookings into upcoming and needs_update at now', async () => {
    const between = slot(60) // after s1 and s2, before s3
    expect((await all('needs_update', between)).seen).toEqual(['s2', 's1'])
    expect((await all('upcoming', between)).seen).toEqual(['s3'])
  })

  it('lists completed and cancelled most recent first, whatever the time', async () => {
    expect((await all('completed', now)).seen).toEqual(['done'])
    expect(await all('cancelled', now, 1)).toEqual({ seen: ['x2', 'x1'], total: 2, pages: 2 })
  })

  it('returns an empty page, not an error, for an empty group', async () => {
    expect(await listOwnGroup(E, { group: 'needs_update', limit: 20 }, now)).toEqual({
      items: [],
      nextCursor: null,
      total: 0,
    })
  })

  it("never returns another student's bookings", async () => {
    for (const group of ['needs_update', 'upcoming', 'completed', 'cancelled'] as const) {
      const page = await listOwnGroup(A, { group, limit: 100 }, now)
      for (const id of Object.values(ids)) expect(page.items.map((x) => x.id)).not.toContain(id)
    }
  })
})

describe('listActiveSlots', () => {
  it('returns future slots that are scheduled or completed, never cancelled or past', async () => {
    const F = await createAuthUser(`svc-f-${stamp}@example.com`)
    try {
      await book(F, input(slot(26)), now)
      const done = await book(F, input(slot(50)), now)
      const gone = await book(F, input(slot(74)), now)
      await setCompleted(F, done.id, true)
      await cancel(F, gone.id)
      expect((await listActiveSlots(F, now)).sort()).toEqual([slot(26).getTime(), slot(50).getTime()])
      expect(await listActiveSlots(F, slot(30))).toEqual([slot(50).getTime()])
    } finally {
      await deleteAuthUser(F)
    }
  })
})
