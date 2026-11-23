import { createClient } from '@supabase/supabase-js'
import { assertLocalSupabaseUrl } from './local-guard'
import { atBusinessTime } from '../lib/consultations/rules'

// Shared by the seed scripts. They delete users with the secret key, so they refuse to run
// against anything but a local Supabase.

process.loadEnvFile('.env.local')

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const secret = process.env.SUPABASE_SECRET_KEY!
assertLocalSupabaseUrl(url)

export const supabase = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
})

export const PASSWORD = 'Password123!'

// Melbourne wall-clock times relative to today, all inside business hours
// (8:00 am to 8:00 pm) and on the quarter hour, so seeded bookings look like
// ones a student could actually have made.
const today = new Date()
export const at = (days: number, hour: number, minute = 0) => atBusinessTime(today, days, hour, minute).toISOString()

export async function deleteUsersByEmail(emails: readonly string[]) {
  const wanted = new Set(emails)
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

export async function createUser(email: string, name?: { first_name: string; last_name: string }): Promise<string> {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    // Same metadata the sign-up form sends; the trigger copies it to profiles.
    user_metadata: name,
  })
  if (error || !data.user) throw error ?? new Error(`createUser failed for ${email}`)
  return data.user.id
}
