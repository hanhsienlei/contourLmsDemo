import { describe, it, expect } from 'vitest';
import {
  isSlotAligned,
  bookingWindow,
  isWithinBookingWindow,
  isWithinBusinessHours,
  atBusinessTime,
  availableSlots,
  HOURS_MESSAGE,
  WINDOW_MESSAGE,
  BOOKING_RULES_SUMMARY,
  BOOKING_HELP,
} from '@/lib/consultations/rules';

// 2030-01-01T09:07Z is 20:07 in Melbourne (AEDT, UTC+11).
const now = new Date('2030-01-01T09:07:00Z');

/** Hour and minute of `d` in Melbourne, for assertions. */
function melbourneHM(d: Date): [number, number] {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Melbourne',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return [get('hour'), get('minute')];
}

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

describe('isWithinBusinessHours (Melbourne, 8:00 am to 8:00 pm)', () => {
  it('accepts 8:00 am and 7:45 pm local, rejects 7:45 am and 8:00 pm', () => {
    // AEDT (UTC+11)
    expect(isWithinBusinessHours(new Date('2030-01-07T08:00:00+11:00'))).toBe(true);
    expect(isWithinBusinessHours(new Date('2030-01-07T19:45:00+11:00'))).toBe(true);
    expect(isWithinBusinessHours(new Date('2030-01-07T07:45:00+11:00'))).toBe(false);
    expect(isWithinBusinessHours(new Date('2030-01-07T20:00:00+11:00'))).toBe(false);
    expect(isWithinBusinessHours(new Date('2030-01-07T01:30:00+11:00'))).toBe(false);
  });
  it('uses the local offset in winter (AEST, UTC+10)', () => {
    expect(isWithinBusinessHours(new Date('2030-07-08T08:00:00+10:00'))).toBe(true);
    expect(isWithinBusinessHours(new Date('2030-07-08T20:00:00+10:00'))).toBe(false);
  });
});

describe('atBusinessTime', () => {
  it('returns the instant for a Melbourne wall-clock time N days after `from`', () => {
    expect(atBusinessTime(now, 0, 9, 0).toISOString()).toBe('2029-12-31T22:00:00.000Z'); // Wed 1 Jan 09:00 AEDT
    expect(atBusinessTime(now, 3, 14, 30).toISOString()).toBe('2030-01-04T03:30:00.000Z');
  });
  it('handles both sides of the DST change', () => {
    expect(melbourneHM(atBusinessTime(new Date('2030-04-05T00:00:00Z'), 2, 9, 0))).toEqual([9, 0]); // after DST ends
    expect(melbourneHM(atBusinessTime(new Date('2030-10-04T00:00:00Z'), 3, 9, 0))).toEqual([9, 0]); // after DST starts
  });
});

describe('availableSlots', () => {
  it('only offers aligned slots inside the window and inside business hours', () => {
    const s = availableSlots(now);
    const { earliest, latest } = bookingWindow(now);
    // now+24h is 20:07 local, after closing, so the first slot is 08:00 the next morning.
    expect(s[0].toISOString()).toBe('2030-01-02T21:00:00.000Z'); // Fri 3 Jan 08:00 AEDT
    expect(melbourneHM(s[s.length - 1])).toEqual([19, 45]);
    for (const d of s) {
      expect(isSlotAligned(d)).toBe(true);
      expect(d.getTime()).toBeGreaterThanOrEqual(earliest.getTime());
      expect(d.getTime()).toBeLessThanOrEqual(latest.getTime());
      expect(isWithinBusinessHours(d)).toBe(true);
    }
    for (let i = 1; i < s.length; i++) expect(s[i].getTime()).toBeGreaterThan(s[i - 1].getTime());
  });
  it('offers 48 slots (8:00 am to 7:45 pm) on each full day', () => {
    const s = availableSlots(now);
    // Sun 5 Jan 08:00 AEDT = 2030-01-04T21:00Z, through 19:45 AEDT = 2030-01-05T08:45Z
    const day = s.filter((d) => d >= new Date('2030-01-04T21:00:00Z') && d <= new Date('2030-01-05T08:45:00Z'));
    expect(day.length).toBe(48);
  });
  it('stays on business hours across the Melbourne DST start', () => {
    const s = availableSlots(new Date('2030-10-05T14:00:00Z'));
    expect(s.every(isWithinBusinessHours)).toBe(true);
    expect(s.length % 48).toBe(0);
  });
});

describe('rule messages', () => {
  it('are built from the constants and agree with each other', () => {
    expect(HOURS_MESSAGE).toBe('Consultations start between 8:00 am and 7:45 pm Melbourne time');
    expect(WINDOW_MESSAGE).toBe('Consultations must be booked between 24 hours and 14 days ahead');
    expect(BOOKING_RULES_SUMMARY).toBe(
      'Consultations start between 8:00 am and 7:45 pm Melbourne time, 24 hours to 14 days ahead.',
    );
  });
});

describe('BOOKING_HELP', () => {
  it('states the window and hours in plain words', () => {
    expect(BOOKING_HELP).toBe('Book 1 to 14 days ahead, 8:00 am to 7:45 pm Melbourne time.');
  });
});
