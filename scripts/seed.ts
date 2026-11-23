import { at, createUser, deleteUsersByEmail, PASSWORD, supabase } from './seed-common'

const EMAILS = { admin: 'admin@demo.local', alice: 'alice@demo.local', bob: 'bob@demo.local' }

async function main() {
  await deleteUsersByEmail(Object.values(EMAILS))

  const adminId = await createUser(EMAILS.admin)
  const aliceId = await createUser(EMAILS.alice, { first_name: 'Alice', last_name: 'Nguyen' })
  const bobId = await createUser(EMAILS.bob, { first_name: 'Bob', last_name: 'Smith' })

  const { error: roleErr } = await supabase.from('user_roles').update({ role: 'admin' }).eq('user_id', adminId)
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
