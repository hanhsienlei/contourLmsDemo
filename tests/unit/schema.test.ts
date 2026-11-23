import { describe, it, expect } from 'vitest'
import {
  createConsultationSchema,
  studentNameSchema,
  updateConsultationSchema,
  adminListQuerySchema,
  encodeCursor,
  decodeCursor,
  parseAdminListQuery,
  parseStudentListQuery,
} from '@/lib/consultations/schema'

const valid = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  reason: 'Career advice',
  scheduledAt: '2030-01-02T10:15:00Z',
}

describe('createConsultationSchema', () => {
  it('parses a valid body', () => {
    expect(createConsultationSchema.parse(valid).firstName).toBe('Ada')
  })
  it('rejects unknown keys', () => {
    expect(() => createConsultationSchema.parse({ ...valid, userId: 'x' })).toThrow()
  })
  it('rejects whitespace-only reason', () => {
    expect(() => createConsultationSchema.parse({ ...valid, reason: '   ' })).toThrow()
  })
  it('rejects 101-char firstName', () => {
    expect(() => createConsultationSchema.parse({ ...valid, firstName: 'a'.repeat(101) })).toThrow()
  })
  it('rejects scheduledAt without offset', () => {
    expect(() => createConsultationSchema.parse({ ...valid, scheduledAt: '2030-01-02T10:15:00' })).toThrow()
  })
  it('rejects misaligned scheduledAt', () => {
    expect(() => createConsultationSchema.parse({ ...valid, scheduledAt: '2030-01-02T10:14:00Z' })).toThrow()
  })

  const messageFor = (input: object, field: string) => {
    const r = createConsultationSchema.safeParse({ ...valid, ...input })
    expect(r.success).toBe(false)
    return r.error!.issues.find((i) => i.path[0] === field)?.message
  }
  it('uses plain-English messages', () => {
    expect(messageFor({ firstName: ' ' }, 'firstName')).toBe('First name is required')
    expect(messageFor({ lastName: '' }, 'lastName')).toBe('Last name is required')
    expect(messageFor({ reason: '' }, 'reason')).toBe('Tell us what the consultation is about')
    expect(messageFor({ firstName: 'a'.repeat(101) }, 'firstName')).toBe('First name must be 100 characters or fewer')
    expect(messageFor({ reason: 'a'.repeat(1001) }, 'reason')).toBe('Reason must be 1000 characters or fewer')
    expect(messageFor({ scheduledAt: '' }, 'scheduledAt')).toBe('Choose a day and time')
    expect(messageFor({ scheduledAt: '2030-01-02T10:14:00Z' }, 'scheduledAt')).toBe('Choose a time on the quarter hour')
  })
})

describe('updateConsultationSchema', () => {
  it('accepts exactly one field', () => {
    expect(updateConsultationSchema.safeParse({ scheduledAt: '2030-01-02T10:15:00Z' }).success).toBe(true)
    expect(updateConsultationSchema.safeParse({ completed: true }).success).toBe(true)
  })
  it('rejects {} and both', () => {
    expect(updateConsultationSchema.safeParse({}).success).toBe(false)
    expect(updateConsultationSchema.safeParse({ scheduledAt: '2030-01-02T10:15:00Z', completed: true }).success).toBe(
      false,
    )
  })
})

describe('adminListQuerySchema', () => {
  it('defaults limit to 20', () => {
    expect(adminListQuerySchema.parse({}).limit).toBe(20)
  })
  it('rejects out-of-range limits', () => {
    expect(adminListQuerySchema.safeParse({ limit: '101' }).success).toBe(false)
    expect(adminListQuerySchema.safeParse({ limit: '0' }).success).toBe(false)
  })
  it('coerces string limit', () => {
    expect(adminListQuerySchema.parse({ limit: '5' }).limit).toBe(5)
  })
})

describe('cursor', () => {
  const c = { scheduledAt: '2030-01-02T10:15:00Z', id: '123e4567-e89b-42d3-a456-426614174000' }
  it('round-trips', () => {
    expect(decodeCursor(encodeCursor(c))).toEqual(c)
  })
  it('returns null on garbage and injection', () => {
    expect(decodeCursor('garbage')).toBeNull()
    expect(decodeCursor(encodeCursor({ ...c, id: 'x),or(1.eq.1' }))).toBeNull()
  })
})

describe('parseAdminListQuery', () => {
  const c = { scheduledAt: '2030-01-02T10:15:00Z', id: '123e4567-e89b-42d3-a456-426614174000' }
  it('returns the limit and decoded cursor', () => {
    expect(parseAdminListQuery({})).toEqual({ cursor: undefined, limit: 20 })
    expect(parseAdminListQuery({ cursor: encodeCursor(c), limit: '5' })).toEqual({ cursor: c, limit: 5 })
  })
  it('returns null for a bad limit or an undecodable cursor', () => {
    expect(parseAdminListQuery({ limit: '101' })).toBeNull()
    expect(parseAdminListQuery({ cursor: 'garbage' })).toBeNull()
  })
})

describe('studentNameSchema (sign-up)', () => {
  it('trims both names', () => {
    expect(studentNameSchema.parse({ firstName: '  Ada ', lastName: ' Lovelace  ' })).toEqual({
      firstName: 'Ada',
      lastName: 'Lovelace',
    })
  })

  it('rejects a blank first name with the student-facing message', () => {
    const r = studentNameSchema.safeParse({ firstName: '   ', lastName: 'Lovelace' })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].message).toBe('First name is required')
  })

  it('rejects a last name over 100 characters', () => {
    const r = studentNameSchema.safeParse({ firstName: 'Ada', lastName: 'x'.repeat(101) })
    expect(r.error?.issues[0].message).toBe('Last name must be 100 characters or fewer')
  })
})

describe('parseStudentListQuery', () => {
  const c = { scheduledAt: '2030-01-01T00:00:00.000Z', id: '11111111-1111-4111-8111-111111111111' }
  it.each(['needs_update', 'upcoming', 'completed', 'cancelled'])('accepts group %s with default limit 20', (group) => {
    expect(parseStudentListQuery({ group })).toEqual({ group, cursor: undefined, limit: 20 })
  })
  it('decodes the cursor and coerces the limit', () => {
    expect(parseStudentListQuery({ group: 'completed', cursor: encodeCursor(c), limit: '5' })).toEqual({
      group: 'completed',
      cursor: c,
      limit: 5,
    })
  })
  it.each([
    ['no group', {}],
    ['unknown group', { group: 'all' }],
    ['repeated group', { group: ['upcoming', 'completed'] }],
    ['bad cursor', { group: 'upcoming', cursor: 'garbage' }],
    ['limit over 100', { group: 'upcoming', limit: '101' }],
    ['unknown key', { group: 'upcoming', userId: c.id }],
  ])('rejects %s', (_, raw) => {
    expect(parseStudentListQuery(raw)).toBeNull()
  })
})

describe('parseAdminListQuery with a group', () => {
  it('accepts an optional group', () => {
    expect(parseAdminListQuery({ group: 'cancelled' })).toEqual({ group: 'cancelled', cursor: undefined, limit: 20 })
    expect(parseAdminListQuery({})).toEqual({ cursor: undefined, limit: 20 })
  })
  it('rejects an unknown group', () => {
    expect(parseAdminListQuery({ group: 'all' })).toBeNull()
  })
})
