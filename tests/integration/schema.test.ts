import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createAuthUser, deleteAuthUser, pgPool } from './helpers/db'

const insert = (userId: string, scheduledAt: string, status = 'scheduled', reason = 'help') =>
  pgPool.query(
    `insert into public.consultations (user_id, first_name, last_name, reason, scheduled_at, status)
     values ($1, 'A', 'B', $2, $3, $4)`,
    [userId, reason, scheduledAt, status],
  )

async function expectCode(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toMatchObject({ code })
}

describe('schema', () => {
  const users: string[] = []
  let uid: string

  beforeAll(async () => {
    uid = await createAuthUser(`t-${crypto.randomUUID()}@test.local`)
    users.push(uid)
  })

  afterAll(async () => {
    for (const id of users) await deleteAuthUser(id)
    await pgPool.end()
  })

  it('has RLS enabled on every public table', async () => {
    const { rows } = await pgPool.query(
      `select tablename from pg_tables where schemaname = 'public' and not rowsecurity`)
    expect(rows).toEqual([])
  })

  it('sign-up trigger creates profile + student role', async () => {
    const id = await createAuthUser(`t-${crypto.randomUUID()}@test.local`)
    users.push(id)
    const p = await pgPool.query('select email from public.profiles where user_id = $1', [id])
    const r = await pgPool.query('select role from public.user_roles where user_id = $1', [id])
    expect(p.rowCount).toBe(1)
    expect(r.rows[0].role).toBe('student')
  })

  it('rejects misaligned scheduled_at, including fractional seconds', async () => {
    await expectCode(insert(uid, '2030-01-01T10:14:59.6Z'), '23514')
    await expectCode(insert(uid, '2030-01-01T10:10:00Z'), '23514')
    await expect(insert(uid, '2030-01-01T10:15:00Z')).resolves.toBeDefined()
  })

  it('allows a cancelled + an active booking in the same slot, but not two active', async () => {
    const t = '2030-02-01T10:00:00Z'
    await insert(uid, t, 'cancelled')
    await insert(uid, t, 'scheduled')
    await expectCode(insert(uid, t, 'scheduled'), '23505')
  })

  it('trims are enforced: whitespace-only reason is rejected', async () => {
    await expectCode(insert(uid, '2030-03-01T10:00:00Z', 'scheduled', '   '), '23514')
  })
})
