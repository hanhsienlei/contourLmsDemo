import { createClient } from '@/lib/supabase/server'

export async function getVerifiedUserId(): Promise<string | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  if (error) return null
  return data?.claims?.sub ?? null
}
