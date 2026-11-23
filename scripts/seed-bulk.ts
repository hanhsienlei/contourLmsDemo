import { at, createUser, deleteUsersByEmail, PASSWORD, supabase } from './seed-common'

// Opt-in volume for trying pagination (20 rows per page): one extra student with more than a
// page in every tab. Leaves the regular demo accounts alone; run `npm run db:seed` first.
// Re-running replaces this student and their bookings.

const EMAIL = 'sam@demo.local'
const NAME = { first_name: 'Sam', last_name: 'Lee' }

/** How many bookings each tab gets. Upcoming spans three pages, the others two. */
const COUNTS = { upcoming: 45, needs_update: 25, completed: 30, cancelled: 22 }

const SUBJECTS = [
  'VCE Methods SAC prep',
  'Chemistry practice exam review',
  'English Language essay structure',
  'Physics motion problems',
  'Biology cell structure revision',
  'Specialist Maths proof questions',
  'Legal Studies case notes',
  'Psychology research methods',
]

const reason = (i: number) => `${SUBJECTS[i % SUBJECTS.length]} (${i + 1})`

async function main() {
  await deleteUsersByEmail([EMAIL])
  const userId = await createUser(EMAIL, NAME)
  const base = { user_id: userId, ...NAME }

  // Distinct (day, time) slots per status, so no two active bookings share a slot (the partial
  // unique index). Upcoming: four a day from 2 days ahead, inside the 14-day window.
  const upcomingTimes = [9, 11, 14, 16]
  const rows = [
    ...Array.from({ length: COUNTS.upcoming }, (_, i) => ({
      ...base,
      reason: reason(i),
      scheduled_at: at(2 + Math.floor(i / upcomingTimes.length), upcomingTimes[i % upcomingTimes.length], 30),
      status: 'scheduled',
    })),
    ...Array.from({ length: COUNTS.needs_update }, (_, i) => ({
      ...base,
      reason: reason(i),
      scheduled_at: at(-1 - i, 10),
      status: 'scheduled',
    })),
    ...Array.from({ length: COUNTS.completed }, (_, i) => ({
      ...base,
      reason: reason(i),
      scheduled_at: at(-1 - i, 15),
      status: 'completed',
    })),
    ...Array.from({ length: COUNTS.cancelled }, (_, i) => ({
      ...base,
      reason: reason(i),
      scheduled_at: at(-1 - i, 12, 30),
      status: 'cancelled',
    })),
  ]
  const { error } = await supabase.from('consultations').insert(rows)
  if (error) throw error

  console.log('Bulk seed complete.')
  console.log(`  Student: ${EMAIL} (password ${PASSWORD})`)
  console.log(`  Consultations inserted: ${rows.length} (${JSON.stringify(COUNTS)})`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
