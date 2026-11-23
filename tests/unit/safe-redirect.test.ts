import { describe, expect, it } from 'vitest'
import { safeNextPath } from '@/lib/auth/safe-redirect'

describe('safeNextPath', () => {
  it.each([
    ['/dashboard', '/dashboard'],
    ['/consultations/new?x=1#top', '/consultations/new?x=1#top'],
    ['/', '/'],
  ])('keeps same-site path %s', (input, expected) => {
    expect(safeNextPath(input)).toBe(expected)
  })

  it.each([
    null,
    '',
    'dashboard',
    'https://evil.com',
    '//evil.com',
    '/\\evil.com',
    '/\t/evil.com', // browsers strip tab/CR/LF, turning this into //evil.com
    '/\n/evil.com',
    '/\r/evil.com',
    '/%09/evil.com'.replace('%09', '\u0009'),
    'javascript:alert(1)',
  ])('falls back to / for %j', (input) => {
    expect(safeNextPath(input)).toBe('/')
  })
})
