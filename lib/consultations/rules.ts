export const SLOT_MINUTES = 15;
export const MIN_LEAD_HOURS = 24;
export const MAX_AHEAD_DAYS = 14;

export type ConsultationStatus = 'scheduled' | 'completed' | 'cancelled';

const SLOT_MS = SLOT_MINUTES * 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

export function isSlotAligned(d: Date): boolean {
  return d.getTime() % SLOT_MS === 0;
}

export function bookingWindow(now: Date): { earliest: Date; latest: Date } {
  const t = now.getTime();
  return {
    earliest: new Date(t + MIN_LEAD_HOURS * HOUR_MS),
    latest: new Date(t + MAX_AHEAD_DAYS * DAY_MS),
  };
}

export function isWithinBookingWindow(d: Date, now: Date): boolean {
  const { earliest, latest } = bookingWindow(now);
  const t = d.getTime();
  return t >= earliest.getTime() && t <= latest.getTime();
}

/**
 * Consultations start between OPEN_HOUR and CLOSE_HOUR (exclusive), on the
 * wall clock of BUSINESS_TIME_ZONE. Contour is Melbourne-based, so a student
 * anywhere sees the same staffed hours converted to their local time.
 */
export const BUSINESS_TIME_ZONE = 'Australia/Melbourne';
export const OPEN_HOUR = 8;
export const CLOSE_HOUR = 20;

const zoneFormat = new Intl.DateTimeFormat('en-AU', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  hourCycle: 'h23',
});

function zonedParts(d: Date) {
  const parts = zoneFormat.formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)!.value);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute') };
}

export function isWithinBusinessHours(d: Date): boolean {
  const { hour, minute } = zonedParts(d);
  const minutes = hour * 60 + minute;
  return minutes >= OPEN_HOUR * 60 && minutes < CLOSE_HOUR * 60;
}

/** The instant that is `hour:minute` on the business wall clock, `dayOffset` days after `from`'s business date. */
export function atBusinessTime(from: Date, dayOffset: number, hour: number, minute: number): Date {
  const p = zonedParts(from);
  const wallAsUtc = Date.UTC(p.year, p.month - 1, p.day + dayOffset, hour, minute);
  // Find the zone offset at that moment by formatting the guess, then correct for it.
  const q = zonedParts(new Date(wallAsUtc));
  const offset = Date.UTC(q.year, q.month - 1, q.day, q.hour, q.minute) - wallAsUtc;
  return new Date(wallAsUtc - offset);
}

export function availableSlots(now: Date): Date[] {
  const { earliest, latest } = bookingWindow(now);
  const end = latest.getTime();
  const slots: Date[] = [];
  for (let t = Math.ceil(earliest.getTime() / SLOT_MS) * SLOT_MS; t <= end; t += SLOT_MS) {
    const d = new Date(t);
    if (isWithinBusinessHours(d)) slots.push(d);
  }
  return slots;
}
