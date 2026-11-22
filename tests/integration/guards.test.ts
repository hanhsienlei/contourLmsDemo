import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createAuthUser, deleteAuthUser, pgPool } from './helpers/db'

const session = vi.hoisted(() => ({ current: null as string | null }))
vi.mock('@/lib/auth/session', () => ({ getVerifiedUserId: async () => session.current }))

import { requireRole, requireUser } from '@/lib/auth/guards'
import { homeFor } from '@/lib/auth/roles'

let student: string
let admin: string
let noRole: string
const stamp = Date.now()

beforeAll(async () => {
  student = await createAuthUser(`g-student-${stamp}@example.com`)
  admin = await createAuthUser(`g-admin-${stamp}@example.com`)
  noRole = await createAuthUser(`g-norole-${stamp}@example.com`)
  await pgPool.query(`update public.user_roles set role = 'admin' where user_id = $1`, [admin])
  await pgPool.query(`delete from public.user_roles where user_id = $1`, [noRole])
})

afterAll(async () => {
  for (const id of [student, admin, noRole]) await deleteAuthUser(id)
  await pgPool.end()
})

describe('guards', () => {
  it('requireUser rejects 401 when no session', async () => {
    session.current = null
    await expect(requireUser()).rejects.toMatchObject({ status: 401 })
  })
  it('student: admin -> 403, student ok', async () => {
    session.current = student
    await expect(requireRole('admin')).rejects.toMatchObject({ status: 403 })
    await expect(requireRole('student')).resolves.toEqual({ userId: student, role: 'student' })
  })
  it('admin passes admin', async () => {
    session.current = admin
    await expect(requireRole('admin')).resolves.toEqual({ userId: admin, role: 'admin' })
  })
  it('no role row fails closed', async () => {
    session.current = noRole
    await expect(requireRole('student')).rejects.toMatchObject({ status: 403 })
  })
  it('homeFor', () => {
    expect(homeFor(null)).toBe('/no-access')
    expect(homeFor('admin')).toBe('/admin')
    expect(homeFor('student')).toBe('/dashboard')
  })
})
