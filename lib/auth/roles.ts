import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { mapDbError } from '@/lib/api/http'

export type AppRole = 'student' | 'admin'

// cache(): one role lookup per server render for a given user.
export const getRole = cache(async (userId: string): Promise<AppRole | null> => {
  const { data, error } = await createAdminClient()
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw mapDbError(error)
  if (!data) return null
  return data.role === 'student' || data.role === 'admin' ? data.role : null
})

export function homeFor(role: AppRole | null): '/admin' | '/dashboard' | '/no-access' {
  if (role === 'admin') return '/admin'
  if (role === 'student') return '/dashboard'
  return '/no-access'
}
