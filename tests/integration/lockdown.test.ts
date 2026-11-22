import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createAuthUser, deleteAuthUser, pgPool } from './helpers/db'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
const opts = { auth: { persistSession: false, autoRefreshToken: false } }

const email = `lockdown-${Date.now()}@test.local`
let studentId: string
let anon: SupabaseClient
let student: SupabaseClient

beforeAll(async () => {
  studentId = await createAuthUser(email, 'Password123!')
  anon = createClient(url, key, opts)
  student = createClient(url, key, opts)
  const { error } = await student.auth.signInWithPassword({ email, password: 'Password123!' })
  if (error) throw error
})

afterAll(async () => {
  await deleteAuthUser(studentId)
  await pgPool.end()
})

describe('direct API lockdown', () => {
  it.each(['consultations', 'profiles', 'user_roles'])('anon cannot read %s', async (t) => {
    const { data, error } = await anon.from(t).select('*')
    expect(data ?? []).toEqual([])
    expect(error?.code).toBe('42501')
  })

  it('signed-in student cannot read or insert consultations directly', async () => {
    const read = await student.from('consultations').select('*')
    expect(read.data ?? []).toEqual([])
    expect(read.error?.code).toBe('42501')
    const ins = await student.from('consultations').insert({
      user_id: studentId,
      first_name: 'Test',
      last_name: 'Student',
      reason: 'direct insert',
      scheduled_at: '2030-01-01T00:00:00Z',
      status: 'scheduled',
    })
    expect(ins.error?.code).toBe('42501')
  })

  it('student cannot promote themselves', async () => {
    const up = await student.from('user_roles').update({ role: 'admin' }).eq('user_id', studentId)
    expect(up.error?.code).toBe('42501')
    const { rows } = await pgPool.query('select role from user_roles where user_id = $1', [studentId])
    expect(rows[0].role).toBe('student')
  })
})
