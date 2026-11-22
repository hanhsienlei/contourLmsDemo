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

export function availableSlots(now: Date): Date[] {
  const { earliest, latest } = bookingWindow(now);
  const end = latest.getTime();
  const slots: Date[] = [];
  for (let t = Math.ceil(earliest.getTime() / SLOT_MS) * SLOT_MS; t <= end; t += SLOT_MS) {
    slots.push(new Date(t));
  }
  return slots;
}
