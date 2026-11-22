import { describe, it, expect } from 'vitest';
import {
  createConsultationSchema,
  updateConsultationSchema,
  idSchema,
  adminListQuerySchema,
  encodeCursor,
  decodeCursor,
} from '@/lib/consultations/schema';

const valid = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  reason: 'Career advice',
  scheduledAt: '2030-01-02T10:15:00Z',
};

describe('createConsultationSchema', () => {
  it('parses a valid body', () => {
    expect(createConsultationSchema.parse(valid).firstName).toBe('Ada');
  });
  it('rejects unknown keys', () => {
    expect(() => createConsultationSchema.parse({ ...valid, userId: 'x' })).toThrow();
  });
  it('rejects whitespace-only reason', () => {
    expect(() => createConsultationSchema.parse({ ...valid, reason: '   ' })).toThrow();
  });
  it('rejects 101-char firstName', () => {
    expect(() => createConsultationSchema.parse({ ...valid, firstName: 'a'.repeat(101) })).toThrow();
  });
  it('rejects scheduledAt without offset', () => {
    expect(() => createConsultationSchema.parse({ ...valid, scheduledAt: '2030-01-02T10:15:00' })).toThrow();
  });
  it('rejects misaligned scheduledAt', () => {
    expect(() => createConsultationSchema.parse({ ...valid, scheduledAt: '2030-01-02T10:14:00Z' })).toThrow();
  });
});

describe('updateConsultationSchema', () => {
  it('accepts exactly one field', () => {
    expect(updateConsultationSchema.safeParse({ scheduledAt: '2030-01-02T10:15:00Z' }).success).toBe(true);
    expect(updateConsultationSchema.safeParse({ completed: true }).success).toBe(true);
  });
  it('rejects {} and both', () => {
    expect(updateConsultationSchema.safeParse({}).success).toBe(false);
    expect(
      updateConsultationSchema.safeParse({ scheduledAt: '2030-01-02T10:15:00Z', completed: true }).success,
    ).toBe(false);
  });
});

describe('idSchema', () => {
  it('rejects non-uuid', () => {
    expect(idSchema.safeParse('1').success).toBe(false);
  });
});

describe('adminListQuerySchema', () => {
  it('defaults limit to 20', () => {
    expect(adminListQuerySchema.parse({}).limit).toBe(20);
  });
  it('rejects out-of-range limits', () => {
    expect(adminListQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
    expect(adminListQuerySchema.safeParse({ limit: '0' }).success).toBe(false);
  });
  it('coerces string limit', () => {
    expect(adminListQuerySchema.parse({ limit: '5' }).limit).toBe(5);
  });
});

describe('cursor', () => {
  const c = { scheduledAt: '2030-01-02T10:15:00Z', id: '123e4567-e89b-42d3-a456-426614174000' };
  it('round-trips', () => {
    expect(decodeCursor(encodeCursor(c))).toEqual(c);
  });
  it('returns null on garbage and injection', () => {
    expect(decodeCursor('garbage')).toBeNull();
    expect(decodeCursor(encodeCursor({ ...c, id: 'x),or(1.eq.1' }))).toBeNull();
  });
});
