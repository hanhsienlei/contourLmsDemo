import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createAuthUser, deleteAuthUser, pgPool } from './helpers/db'

const session = vi.hoisted(() => ({ current: null as string | null }))
vi.mock('@/lib/auth/session', () => ({ getVerifiedUserId: async () => session.current }))

import { GET as listGet, POST as createPost } from '@/app/api/consultations/route'
import { PATCH as patchById } from '@/app/api/consultations/[id]/route'
import { POST as cancelPost } from '@/app/api/consultations/[id]/cancel/route'
import { GET as adminGet } from '@/app/api/admin/consultations/route'
import { availableSlots } from '@/lib/consultations/rules'

const BASE = 'http://localhost:3000'
const stamp = Date.now()
let A: string
let B: string
let ADMIN: string
let n = 0

// The routes use the real clock, so pick from the real open slots (inside the
// booking window and business hours). Start a few days in so a slot can't drift
// below the 24-hour minimum mid-run, and offset by run so reruns don't collide.
const openSlots = availableSlots(new Date())
const slot = () => openSlots[96 + ((stamp % 50) + ++n) * 2].toISOString()
const body = (extra: object = {}) => ({
  firstName: 'Ada',
  lastName: 'Lovelace',
  reason: 'Help',
  scheduledAt: slot(),
  ...extra,
})
const req = (method: string, path: string, b?: unknown, headers: Record<string, string> = {}) =>
  new Request(BASE + path, {
    method,
    headers: { origin: BASE, 'content-type': 'application/json', ...headers },
    body: b === undefined ? undefined : JSON.stringify(b),
  })
const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
const errShape = { error: { code: expect.any(String), message: expect.any(String) } }

beforeAll(async () => {
  A = await createAuthUser(`api-a-${stamp}@example.com`)
  B = await createAuthUser(`api-b-${stamp}@example.com`)
  ADMIN = await createAuthUser(`api-admin-${stamp}@example.com`)
  await pgPool.query(`update public.user_roles set role = 'admin' where user_id = $1`, [ADMIN])
})

afterAll(async () => {
  for (const id of [A, B, ADMIN]) await deleteAuthUser(id)
  await pgPool.end()
})

async function bookAs(user: string) {
  session.current = user
  const res = await createPost(req('POST', '/api/consultations', body()))
  expect(res.status).toBe(201)
  return (await res.json()).item as { id: string }
}

describe('booking', () => {
  it('valid POST -> 201 {item}', async () => {
    session.current = A
    const res = await createPost(req('POST', '/api/consultations', body()))
    expect(res.status).toBe(201)
    expect((await res.json()).item.status).toBe('scheduled')
  })
  it('GET lists one page of a group: {items, nextCursor, total}', async () => {
    session.current = A
    const res = await listGet(req('GET', '/api/consultations?group=upcoming&limit=1'))
    expect(res.status).toBe(200)
    const j = await res.json()
    expect(j.items).toHaveLength(1)
    expect(j.total).toBeGreaterThanOrEqual(1)
    expect(j).toHaveProperty('nextCursor')
  })
  it.each([
    ['no group', ''],
    ['unknown group', '?group=all'],
    ['bad cursor', '?group=upcoming&cursor=garbage'],
    ['limit over 100', '?group=upcoming&limit=101'],
    ['unknown param', '?group=upcoming&userId=x'],
  ])('GET with %s -> 400', async (_, qs) => {
    session.current = A
    const res = await listGet(req('GET', `/api/consultations${qs}`))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject(errShape)
  })
  it('different Origin -> 403', async () => {
    session.current = A
    const res = await createPost(req('POST', '/api/consultations', body(), { origin: 'http://evil.example' }))
    expect(res.status).toBe(403)
    const j = await res.json()
    expect(j).toMatchObject(errShape)
    expect(j.error.code).toBe('forbidden')
  })
  it('userId in body -> 400', async () => {
    session.current = A
    const res = await createPost(req('POST', '/api/consultations', body({ userId: B })))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject(errShape)
  })
  it('not signed in -> 401', async () => {
    session.current = null
    const res = await createPost(req('POST', '/api/consultations', body()))
    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject(errShape)
  })
})

describe('changes by id', () => {
  it('bad uuid -> 400', async () => {
    session.current = A
    const res = await patchById(req('PATCH', '/api/consultations/not-a-uuid', { completed: true }), ctx('not-a-uuid'))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject(errShape)
  })
  it("B patching A's booking -> 404", async () => {
    const item = await bookAs(A)
    session.current = B
    const res = await patchById(req('PATCH', `/api/consultations/${item.id}`, { completed: true }), ctx(item.id))
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject(errShape)
  })
  it('A completes -> 200 completed', async () => {
    const item = await bookAs(A)
    const res = await patchById(req('PATCH', `/api/consultations/${item.id}`, { completed: true }), ctx(item.id))
    expect(res.status).toBe(200)
    expect((await res.json()).item.status).toBe('completed')
  })
  it('A reschedules -> 200', async () => {
    const item = await bookAs(A)
    const to = slot()
    const res = await patchById(req('PATCH', `/api/consultations/${item.id}`, { scheduledAt: to }), ctx(item.id))
    expect(res.status).toBe(200)
    expect(new Date((await res.json()).item.scheduledAt).toISOString()).toBe(to)
  })
  it('cancel twice -> 200 then 409', async () => {
    const item = await bookAs(A)
    const r1 = await cancelPost(req('POST', `/api/consultations/${item.id}/cancel`, {}), ctx(item.id))
    expect(r1.status).toBe(200)
    const r2 = await cancelPost(req('POST', `/api/consultations/${item.id}/cancel`, {}), ctx(item.id))
    expect(r2.status).toBe(409)
    expect(await r2.json()).toMatchObject(errShape)
  })
})

describe('origin check runs before auth', () => {
  const evil = { origin: 'http://evil.example' }
  it('POST create, no session, bad origin -> 403 not 401', async () => {
    session.current = null
    const res = await createPost(req('POST', '/api/consultations', body(), evil))
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('forbidden')
  })
  it('PATCH by id, no session, bad origin -> 403 not 401', async () => {
    session.current = null
    const id = '00000000-0000-4000-8000-000000000000'
    const res = await patchById(req('PATCH', `/api/consultations/${id}`, { completed: true }, evil), ctx(id))
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('forbidden')
  })
  it('cancel, no session, bad origin -> 403 not 401', async () => {
    session.current = null
    const id = '00000000-0000-4000-8000-000000000000'
    const res = await cancelPost(req('POST', `/api/consultations/${id}/cancel`, {}, evil), ctx(id))
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('forbidden')
  })
})

describe('extra validation', () => {
  const id = '00000000-0000-4000-8000-000000000000'
  it('PATCH with both keys -> 400', async () => {
    session.current = A
    const res = await patchById(
      req('PATCH', `/api/consultations/${id}`, { completed: true, scheduledAt: slot() }),
      ctx(id),
    )
    expect(res.status).toBe(400)
  })
  it('PATCH with {} -> 400', async () => {
    session.current = A
    const res = await patchById(req('PATCH', `/api/consultations/${id}`, {}), ctx(id))
    expect(res.status).toBe(400)
  })
  it('cancel with non-uuid -> 400', async () => {
    session.current = A
    const res = await cancelPost(req('POST', '/api/consultations/nope/cancel', {}), ctx('nope'))
    expect(res.status).toBe(400)
  })
})

describe('admin list', () => {
  it('student -> 403', async () => {
    session.current = A
    const res = await adminGet(req('GET', '/api/admin/consultations'))
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject(errShape)
  })
  it('admin -> 200 items array', async () => {
    session.current = ADMIN
    const res = await adminGet(req('GET', '/api/admin/consultations'))
    expect(res.status).toBe(200)
    expect(Array.isArray((await res.json()).items)).toBe(true)
  })
  it('limit=101 -> 400', async () => {
    session.current = ADMIN
    const res = await adminGet(req('GET', '/api/admin/consultations?limit=101'))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject(errShape)
  })
  it('admin GET with a group -> one page of it with a total', async () => {
    session.current = ADMIN
    const res = await adminGet(req('GET', '/api/admin/consultations?group=upcoming&limit=1'))
    expect(res.status).toBe(200)
    const j = await res.json()
    expect(j.items.length).toBeLessThanOrEqual(1)
    expect(typeof j.total).toBe('number')
  })
  it('admin GET with an unknown group -> 400', async () => {
    session.current = ADMIN
    const res = await adminGet(req('GET', '/api/admin/consultations?group=all'))
    expect(res.status).toBe(400)
  })
  it('cursor=garbage -> 400', async () => {
    session.current = ADMIN
    const res = await adminGet(req('GET', '/api/admin/consultations?cursor=garbage'))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject(errShape)
  })
})
