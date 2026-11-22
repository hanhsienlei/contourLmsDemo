import { describe, it, expect } from 'vitest';
import {
  isSlotAligned,
  bookingWindow,
  isWithinBookingWindow,
  availableSlots,
} from '@/lib/consultations/rules';

const STEP = 15 * 60_000;
const now = new Date('2030-01-01T09:07:00Z');

describe('isSlotAligned', () => {
  it('accepts quarter-hours only', () => {
    expect(isSlotAligned(new Date('2030-01-01T10:15:00Z'))).toBe(true);
    expect(isSlotAligned(new Date('2030-01-01T10:14:59.600Z'))).toBe(false);
    expect(isSlotAligned(new Date('2030-01-01T10:10:00Z'))).toBe(false);
  });
});

describe('bookingWindow', () => {
  it('is now+24h to now+14d', () => {
    const w = bookingWindow(now);
    expect(w.earliest.toISOString()).toBe('2030-01-02T09:07:00.000Z');
    expect(w.latest.toISOString()).toBe('2030-01-15T09:07:00.000Z');
  });
  it('is inclusive at both edges', () => {
    const { earliest, latest } = bookingWindow(now);
    expect(isWithinBookingWindow(earliest, now)).toBe(true);
    expect(isWithinBookingWindow(latest, now)).toBe(true);
    expect(isWithinBookingWindow(new Date(earliest.getTime() - 1), now)).toBe(false);
    expect(isWithinBookingWindow(new Date(latest.getTime() + 1), now)).toBe(false);
  });
});

describe('availableSlots', () => {
  it('spans first aligned slot to last, ascending and aligned', () => {
    const s = availableSlots(now);
    expect(s[0].toISOString()).toBe('2030-01-02T09:15:00.000Z');
    expect(s[s.length - 1].toISOString()).toBe('2030-01-15T09:00:00.000Z');
    expect(s.every(isSlotAligned)).toBe(true);
    for (let i = 1; i < s.length; i++) expect(s[i].getTime()).toBeGreaterThan(s[i - 1].getTime());
    expect(s.length).toBe((s[s.length - 1].getTime() - s[0].getTime()) / STEP + 1);
  });
  it('has no gaps or duplicates across Melbourne DST start', () => {
    const s = availableSlots(new Date('2030-10-05T14:00:00Z'));
    expect(s.length).toBe((s[s.length - 1].getTime() - s[0].getTime()) / STEP + 1);
  });
});
