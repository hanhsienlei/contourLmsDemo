import { createClient } from '@supabase/supabase-js'
import pg from 'pg'

export const pgPool = new pg.Pool({ connectionString: process.env.SUPABASE_DB_URL })

function secretClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export async function createAuthUser(
  email: string,
  password?: string,
  userMetadata?: Record<string, unknown>,
): Promise<string> {
  const { data, error } = await secretClient().auth.admin.createUser({
    email,
    password: password ?? 'Password123!',
    email_confirm: true,
    user_metadata: userMetadata,
  })
  if (error || !data.user) throw error ?? new Error('createUser returned no user')
  return data.user.id
}

export async function deleteAuthUser(id: string): Promise<void> {
  const { error } = await secretClient().auth.admin.deleteUser(id)
  if (error) throw error
}
