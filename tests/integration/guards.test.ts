import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createAuthUser, deleteAuthUser, pgPool } from './helpers/db'

const session = vi.hoisted(() => ({ current: null as string | null }))
vi.mock('@/lib/auth/session', () => ({ getVerifiedUserId: async () => session.current }))

const nav = vi.hoisted(() => ({
  redirect: (url: string): never => {
    throw new Error(`REDIRECT:${url}`)
  },
}))
vi.mock('next/navigation', async (orig) => ({
  ...(await orig<typeof import('next/navigation')>()),
  redirect: nav.redirect,
}))

import { requireRole, requireRolePage, requireUser } from '@/lib/auth/guards'
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

  describe('requireRolePage', () => {
    it('sends signed-out users to /auth/login', async () => {
      session.current = null
      await expect(requireRolePage('admin')).rejects.toThrow('REDIRECT:/auth/login')
    })
    it('sends a student asking for admin to /dashboard', async () => {
      session.current = student
      await expect(requireRolePage('admin')).rejects.toThrow('REDIRECT:/dashboard')
    })
    it('sends an admin asking for student to /admin', async () => {
      session.current = admin
      await expect(requireRolePage('student')).rejects.toThrow('REDIRECT:/admin')
    })
    it('sends a user with no role to /no-access', async () => {
      session.current = noRole
      await expect(requireRolePage('student')).rejects.toThrow('REDIRECT:/no-access')
    })
    it('resolves { userId } on a matching role', async () => {
      session.current = student
      await expect(requireRolePage('student')).resolves.toEqual({ userId: student })
    })
  })
})
