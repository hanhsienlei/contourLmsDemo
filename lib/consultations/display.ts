import { format, formatDistanceStrict } from 'date-fns';
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

/** "in 2 days", "3 hours ago". */
export function relativeTime(iso: string, now: Date): string {
  return formatDistanceStrict(new Date(iso), now, { addSuffix: true });
}

/** e.g. "Adelaide time (ACDT)". Falls back to the raw name, or "your local time" when unknown. */
export function timeZoneLabel(timeZone: string | undefined, at: Date): string {
  if (!timeZone) return 'your local time';
  try {
    const abbreviation = new Intl.DateTimeFormat('en-AU', { timeZone, timeZoneName: 'short' })
      .formatToParts(at)
      .find((p) => p.type === 'timeZoneName')?.value;
    const city = timeZone.split('/').pop()!.replaceAll('_', ' ');
    return abbreviation ? `${city} time (${abbreviation})` : `${city} time`;
  } catch {
    return timeZone;
  }
}

export type DayPeriod = 'Morning' | 'Afternoon' | 'Evening';

const PERIODS: DayPeriod[] = ['Morning', 'Afternoon', 'Evening'];

export function slotPeriod(d: Date): DayPeriod {
  const hour = d.getHours();
  if (hour < 12) return 'Morning';
  return hour < 17 ? 'Afternoon' : 'Evening';
}

export function groupSlotsByPeriod(slots: readonly Date[]): { period: DayPeriod; slots: Date[] }[] {
  const by: Record<DayPeriod, Date[]> = { Morning: [], Afternoon: [], Evening: [] };
  for (const slot of slots) by[slotPeriod(slot)].push(slot);
  return PERIODS.filter((period) => by[period].length > 0).map((period) => ({ period, slots: by[period] }));
}

/** Local calendar day as yyyy-MM-dd. */
export const dayKey = (d: Date): string => format(d, 'yyyy-MM-dd');

/** The day to show first: the current booking's day if offered, else the first offered day. */
export function initialDay(dayKeys: readonly string[], currentIso?: string): string | undefined {
  if (currentIso) {
    const current = dayKey(new Date(currentIso));
    if (dayKeys.includes(current)) return current;
  }
  return dayKeys[0];
}

/** Epoch ms of slots already taken by this student (scheduled or completed). */
export function activeSlotKeys(items: readonly Pick<Consultation, 'status' | 'scheduledAt'>[]): Set<number> {
  return new Set(items.filter((i) => i.status !== 'cancelled').map((i) => Date.parse(i.scheduledAt)));
}

/** Name to prefill on a new booking: from the most recently created row, whatever its status. */
export function prefillName(
  items: readonly Pick<Consultation, 'firstName' | 'lastName' | 'createdAt'>[],
): { firstName: string; lastName: string } {
  let latest: (typeof items)[number] | undefined;
  for (const item of items) {
    if (!latest || Date.parse(item.createdAt) > Date.parse(latest.createdAt)) latest = item;
  }
  return { firstName: latest?.firstName ?? '', lastName: latest?.lastName ?? '' };
}

export type RowAction = 'complete' | 'incomplete' | 'reschedule' | 'cancel';

/** Visible text of each row action's button or menu item. */
export const ROW_ACTION_LABEL: Record<RowAction, string> = {
  complete: 'Mark complete',
  incomplete: 'Mark incomplete',
  reschedule: 'Reschedule',
  cancel: 'Cancel',
};

/**
 * Accessible name for a row action: the visible text first, then the slot, so voice control still
 * matches what is on screen. Undefined until the slot label is known (the visible text is the name).
 */
export function actionAriaLabel(action: RowAction, slotLabel: string): string | undefined {
  return slotLabel ? `${ROW_ACTION_LABEL[action]}, consultation on ${slotLabel}` : undefined;
}

/** Row actions for a display state. The primary action is `visible[0]`; `menu` holds the rest. */
export function actionsFor(state: DisplayState): { visible: RowAction[]; menu: RowAction[] } {
  switch (state) {
    case 'upcoming':
      return { visible: ['complete', 'reschedule', 'cancel'], menu: [] };
    case 'needs_update':
      return { visible: ['complete', 'reschedule'], menu: ['cancel'] };
    case 'completed':
      return { visible: ['incomplete'], menu: [] };
    case 'cancelled':
      return { visible: [], menu: [] };
  }
}

/** Actions that open a dialog (the others run inline). */
export type DialogAction = Extract<RowAction, 'reschedule' | 'cancel'>;
const isDialogAction = (a: RowAction): a is DialogAction => a === 'reschedule' || a === 'cancel';

export type RowLayout = {
  primary?: RowAction;
  /** Dialog buttons from `sm` up, mirrored as menu items below `sm`. */
  secondary: DialogAction[];
  /** Dialog actions that appear only in the ⋯ menu. */
  menuOnly: DialogAction[];
  /** When the ⋯ trigger shows: never, below `sm` (mirrored items only), or always (has menu-only items). */
  menuVisibility: 'never' | 'below-sm' | 'always';
};

/** How a row lays out its actions between visible buttons and the ⋯ menu. */
export function rowLayout(state: DisplayState): RowLayout {
  const { visible, menu } = actionsFor(state);
  const [primary, ...secondary] = visible;
  const dialogSecondary = secondary.filter(isDialogAction);
  const menuOnly = menu.filter(isDialogAction);
  const menuVisibility = menuOnly.length > 0 ? 'always' : dialogSecondary.length > 0 ? 'below-sm' : 'never';
  return { primary, secondary: dialogSecondary, menuOnly, menuVisibility };
}
