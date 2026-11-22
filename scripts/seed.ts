import { createClient } from '@supabase/supabase-js'
import { assertLocalSupabaseUrl } from './local-guard'
import { atBusinessTime } from '../lib/consultations/rules'

process.loadEnvFile('.env.local')

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const secret = process.env.SUPABASE_SECRET_KEY!
assertLocalSupabaseUrl(url)

const supabase = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const PASSWORD = 'Password123!'
const EMAILS = { admin: 'admin@demo.local', alice: 'alice@demo.local', bob: 'bob@demo.local' }

// Melbourne wall-clock times relative to today, all inside business hours
// (8:00 am to 8:00 pm) and on the quarter hour, so seeded bookings look like
// ones a student could actually have made.
const today = new Date()
const at = (days: number, hour: number, minute = 0) => atBusinessTime(today, days, hour, minute).toISOString()

async function deleteExistingDemoUsers() {
  const wanted = new Set(Object.values(EMAILS))
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    for (const u of data.users) {
      if (u.email && wanted.has(u.email)) {
        const { error: delErr } = await supabase.auth.admin.deleteUser(u.id)
        if (delErr) throw delErr
      }
    }
    if (data.users.length < 1000) break
  }
}

async function createUser(email: string): Promise<string> {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  })
  if (error || !data.user) throw error ?? new Error(`createUser failed for ${email}`)
  return data.user.id
}

async function main() {
  await deleteExistingDemoUsers()

  const adminId = await createUser(EMAILS.admin)
  const aliceId = await createUser(EMAILS.alice)
  const bobId = await createUser(EMAILS.bob)

  const { error: roleErr } = await supabase
    .from('user_roles')
    .update({ role: 'admin' })
    .eq('user_id', adminId)
  if (roleErr) throw roleErr

  const alice = { user_id: aliceId, first_name: 'Alice', last_name: 'Nguyen' }
  const bob = { user_id: bobId, first_name: 'Bob', last_name: 'Smith' }
  const rows = [
    { ...alice, reason: 'Help with VCE Methods SAC prep', scheduled_at: at(2, 10), status: 'scheduled' },
    { ...alice, reason: 'Essay structure for English Language', scheduled_at: at(5, 15, 15), status: 'scheduled' },
    { ...alice, reason: 'Review of Chemistry practice exam', scheduled_at: at(-3, 16), status: 'scheduled' },
    { ...alice, reason: 'Study plan for Term 3 exams', scheduled_at: at(-7, 11), status: 'completed' },
    { ...alice, reason: 'Specialist Maths integration questions', scheduled_at: at(4, 14), status: 'completed' },
    { ...alice, reason: 'Physics projectile motion', scheduled_at: at(5, 15, 15), status: 'cancelled' },
    { ...bob, reason: 'University pathway advice', scheduled_at: at(2, 17, 30), status: 'scheduled' },
    { ...bob, reason: 'Biology SAC feedback', scheduled_at: at(10, 9, 30), status: 'scheduled' },
    { ...bob, reason: 'Clash with sports training', scheduled_at: at(-1, 13), status: 'cancelled' },
    { ...bob, reason: 'Algebra revision session', scheduled_at: at(-2, 10, 30), status: 'completed' },
  ]
  const { error: insErr } = await supabase.from('consultations').insert(rows)
  if (insErr) throw insErr

  console.log('Seed complete.')
  console.log(`  Accounts (password ${PASSWORD}): ${Object.values(EMAILS).join(', ')}`)
  console.log(`  admin: ${EMAILS.admin}; students: alice, bob`)
  console.log(`  Consultations inserted: ${rows.length}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
