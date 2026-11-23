import { describe, expect, it } from 'vitest'
import { assertLocalSupabaseUrl } from '../../scripts/local-guard'

describe('assertLocalSupabaseUrl', () => {
  it.each(['http://127.0.0.1:54321', 'http://localhost:54321'])('allows %s', (u) =>
    expect(() => assertLocalSupabaseUrl(u)).not.toThrow(),
  )
  it.each(['https://abc.supabase.co', 'http://localhost.evil.com', 'not a url'])('refuses %s', (u) =>
    expect(() => assertLocalSupabaseUrl(u)).toThrow(),
  )
})
