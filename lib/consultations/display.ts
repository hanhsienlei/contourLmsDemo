import type { Consultation } from './service';

/**
 * How a consultation is presented, derived from status and time.
 * Display only: a past `scheduled` booking can still be cancelled through
 * the API (spec D1); the UI just puts Mark complete and Reschedule first.
 */
export type DisplayState = 'upcoming' | 'needs_update' | 'completed' | 'cancelled';

export const DISPLAY_STATE_LABEL: Record<DisplayState, string> = {
  upcoming: 'Scheduled',
  needs_update: 'Past, not marked',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

type Timed = Pick<Consultation, 'status' | 'scheduledAt'>;
type Groupable = Pick<Consultation, 'id' | 'status' | 'scheduledAt'>;

export function displayState(item: Timed, now: Date): DisplayState {
  if (item.status === 'completed') return 'completed';
  if (item.status === 'cancelled') return 'cancelled';
  return Date.parse(item.scheduledAt) >= now.getTime() ? 'upcoming' : 'needs_update';
}

export type StudentGroups<T> = {
  needsUpdate: T[];
  upcoming: T[];
  history: { completed: T[]; cancelled: T[] };
};

const soonestFirst = (a: Groupable, b: Groupable) =>
  Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt) || a.id.localeCompare(b.id);
const mostRecentFirst = (a: Groupable, b: Groupable) =>
  Date.parse(b.scheduledAt) - Date.parse(a.scheduledAt) || a.id.localeCompare(b.id);

/** Sections of the student dashboard (spec §6.1), each in its display order. */
export function groupForStudent<T extends Groupable>(items: readonly T[], now: Date): StudentGroups<T> {
  const by: Record<DisplayState, T[]> = { upcoming: [], needs_update: [], completed: [], cancelled: [] };
  for (const item of items) by[displayState(item, now)].push(item);
  return {
    needsUpdate: by.needs_update.sort(mostRecentFirst),
    upcoming: by.upcoming.sort(soonestFirst),
    history: {
      completed: by.completed.sort(mostRecentFirst),
      cancelled: by.cancelled.sort(mostRecentFirst),
    },
  };
}
