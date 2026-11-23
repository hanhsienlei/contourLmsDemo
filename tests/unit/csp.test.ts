import { describe, expect, it } from 'vitest'
import { buildCsp, createNonce, extractNonce } from '@/lib/csp'

const directives = (csp: string) =>
  Object.fromEntries(
    csp.split(';').map((d) => {
      const [name, ...values] = d.trim().split(/\s+/)
      return [name, values]
    }),
  )

describe('buildCsp', () => {
  const opts = { isDev: false, supabaseUrl: 'https://abc.supabase.co' }

  it('allows scripts only with the request nonce, never inline', () => {
    const d = directives(buildCsp('n0nce', opts))
    expect(d['script-src']).toEqual(["'self'", "'nonce-n0nce'", "'strict-dynamic'"])
    expect(d['script-src']).not.toContain("'unsafe-inline'")
  })

  it("adds 'unsafe-eval' in development only", () => {
    expect(directives(buildCsp('n', { ...opts, isDev: true }))['script-src']).toContain("'unsafe-eval'")
    expect(directives(buildCsp('n', opts))['script-src']).not.toContain("'unsafe-eval'")
  })

  it('keeps the other directives', () => {
    const d = directives(buildCsp('n', opts))
    expect(d['default-src']).toEqual(["'self'"])
    expect(d['connect-src']).toEqual(["'self'", 'https://abc.supabase.co'])
    expect(d['object-src']).toEqual(["'none'"])
    expect(d['frame-ancestors']).toEqual(["'none'"])
    expect(d['base-uri']).toEqual(["'self'"])
    expect(d['form-action']).toEqual(["'self'"])
  })
})

describe('createNonce', () => {
  it('is base64 and different on every call', () => {
    const a = createNonce()
    const b = createNonce()
    expect(a).toMatch(/^[A-Za-z0-9+/]+=*$/)
    expect(a).not.toBe(b)
  })
})

describe('extractNonce', () => {
  it('reads back the nonce buildCsp put in', () => {
    const nonce = createNonce()
    expect(extractNonce(buildCsp(nonce, { isDev: true, supabaseUrl: 'http://127.0.0.1:54321' }))).toBe(nonce)
  })
  it('is undefined without a header or a nonce', () => {
    expect(extractNonce(null)).toBeUndefined()
    expect(extractNonce("default-src 'self'")).toBeUndefined()
  })
})
