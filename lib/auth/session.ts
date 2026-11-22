import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

// cache(): one verification per server render, however many layouts/pages ask.
export const getVerifiedUserId = cache(async (): Promise<string | null> => {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  if (error) return null
  return data?.claims?.sub ?? null
})
