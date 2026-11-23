import { describe, it, expect } from 'vitest';
import {
  DISPLAY_STATE_LABEL,
  displayState,
  relativeTime,
  timeZoneLabel,
  slotPeriod,
  groupSlotsByPeriod,
  dayKey,
  initialDay,
  actionsFor,
  rowLayout,
  ROW_ACTION_LABEL,
  actionAriaLabel,
  groupByLocalDay,
  slotButtonState,
  moreActionsAriaLabel,
  sectionPageHref,
} from '@/lib/consultations/display';
import type { ConsultationStatus } from '@/lib/consultations/rules';

const now = new Date('2030-01-10T00:00:00Z');
const MIN = 60_000;
const DAY = 24 * 60 * MIN;

const iso = (offsetMs: number) => new Date(now.getTime() + offsetMs).toISOString();
const c = (id: string, status: ConsultationStatus, scheduledAt: string) => ({ id, status, scheduledAt });

describe('displayState', () => {
  it('is upcoming for a scheduled booking in the future', () => {
    expect(displayState(c('x', 'scheduled', iso(MIN)), now)).toBe('upcoming');
  });

  it('is upcoming when scheduledAt equals now exactly', () => {
    expect(displayState(c('x', 'scheduled', now.toISOString()), now)).toBe('upcoming');
  });

  it('is needs_update for a scheduled booking in the past', () => {
    expect(displayState(c('x', 'scheduled', iso(-MIN)), now)).toBe('needs_update');
  });

  it('is completed whatever the time', () => {
    expect(displayState(c('x', 'completed', iso(-DAY)), now)).toBe('completed');
    expect(displayState(c('x', 'completed', iso(DAY)), now)).toBe('completed');
  });

  it('is cancelled whatever the time', () => {
    expect(displayState(c('x', 'cancelled', iso(-DAY)), now)).toBe('cancelled');
    expect(displayState(c('x', 'cancelled', iso(DAY)), now)).toBe('cancelled');
  });
});

describe('DISPLAY_STATE_LABEL', () => {
  it('has a text label for every state', () => {
    expect(DISPLAY_STATE_LABEL).toEqual({
      upcoming: 'Scheduled',
      needs_update: 'Past, not marked',
      completed: 'Completed',
      cancelled: 'Cancelled',
    });
  });
});

describe('relativeTime', () => {
  it('describes future and past instants', () => {
    expect(relativeTime(iso(2 * DAY), now)).toBe('in 2 days');
    expect(relativeTime(iso(3 * 60 * MIN), now)).toBe('in 3 hours');
    expect(relativeTime(iso(-3 * DAY), now)).toBe('3 days ago');
  });
});

describe('timeZoneLabel', () => {
  it('names the city and abbreviation', () => {
    expect(timeZoneLabel('Australia/Adelaide', now)).toBe('Adelaide time (ACDT)');
    expect(timeZoneLabel('Australia/Melbourne', now)).toBe('Melbourne time (AEDT)');
    expect(timeZoneLabel('America/New_York', now)).toMatch(/^New York time \(/);
  });

  it('falls back for an invalid or missing zone', () => {
    expect(timeZoneLabel('Not/AZone', now)).toBe('Not/AZone');
    expect(timeZoneLabel(undefined, now)).toBe('your local time');
  });
});

describe('slotPeriod', () => {
  it('splits the day at 12:00 and 17:00 local time', () => {
    expect(slotPeriod(new Date(2030, 0, 10, 11, 45))).toBe('Morning');
    expect(slotPeriod(new Date(2030, 0, 10, 12, 0))).toBe('Afternoon');
    expect(slotPeriod(new Date(2030, 0, 10, 16, 59))).toBe('Afternoon');
    expect(slotPeriod(new Date(2030, 0, 10, 17, 0))).toBe('Evening');
  });
});

describe('groupSlotsByPeriod', () => {
  it('groups in period order and leaves out empty periods', () => {
    const evening = new Date(2030, 0, 10, 18, 0);
    const morning = new Date(2030, 0, 10, 9, 0);
    const afternoon = new Date(2030, 0, 10, 13, 0);
    expect(groupSlotsByPeriod([evening, morning, afternoon])).toEqual([
      { period: 'Morning', slots: [morning] },
      { period: 'Afternoon', slots: [afternoon] },
      { period: 'Evening', slots: [evening] },
    ]);
  });

  it('gives one group for morning-only input', () => {
    const slots = [new Date(2030, 0, 10, 8, 0), new Date(2030, 0, 10, 8, 15)];
    expect(groupSlotsByPeriod(slots)).toEqual([{ period: 'Morning', slots }]);
  });
});

describe('dayKey', () => {
  it('is the local yyyy-MM-dd', () => {
    expect(dayKey(new Date(2030, 0, 5, 23, 59))).toBe('2030-01-05');
  });
});

describe('initialDay', () => {
  const days = ['2030-01-11', '2030-01-12'];

  it('uses the current booking day when it is listed', () => {
    expect(initialDay(days, new Date(2030, 0, 12, 9, 0).toISOString())).toBe('2030-01-12');
  });

  it('falls back to the first day otherwise', () => {
    expect(initialDay(days, new Date(2030, 0, 20, 9, 0).toISOString())).toBe('2030-01-11');
    expect(initialDay(days)).toBe('2030-01-11');
  });

  it('is undefined when there are no days', () => {
    expect(initialDay([])).toBeUndefined();
  });
});

describe('actionsFor', () => {
  it('lists row actions per display state', () => {
    expect(actionsFor('upcoming')).toEqual({ visible: ['complete', 'reschedule', 'cancel'], menu: [] });
    expect(actionsFor('needs_update')).toEqual({ visible: ['complete', 'reschedule'], menu: ['cancel'] });
    expect(actionsFor('completed')).toEqual({ visible: ['incomplete'], menu: [] });
    expect(actionsFor('cancelled')).toEqual({ visible: [], menu: [] });
  });
});

describe('rowLayout', () => {
  it('upcoming: complete is primary, the rest are buttons mirrored in the menu below sm', () => {
    expect(rowLayout('upcoming')).toEqual({
      primary: 'complete',
      secondary: ['reschedule', 'cancel'],
      menuOnly: [],
      menuVisibility: 'below-sm',
    });
  });

  it('needs_update: cancel lives only in the menu, which is always shown', () => {
    expect(rowLayout('needs_update')).toEqual({
      primary: 'complete',
      secondary: ['reschedule'],
      menuOnly: ['cancel'],
      menuVisibility: 'always',
    });
  });

  it('completed: only the primary action, no menu', () => {
    expect(rowLayout('completed')).toEqual({
      primary: 'incomplete',
      secondary: [],
      menuOnly: [],
      menuVisibility: 'never',
    });
  });

  it('cancelled: nothing to do, no menu', () => {
    expect(rowLayout('cancelled')).toEqual({
      primary: undefined,
      secondary: [],
      menuOnly: [],
      menuVisibility: 'never',
    });
  });
});

describe('ROW_ACTION_LABEL', () => {
  it('has the visible text for every row action', () => {
    expect(ROW_ACTION_LABEL).toEqual({
      complete: 'Mark complete',
      incomplete: 'Mark incomplete',
      reschedule: 'Reschedule',
      cancel: 'Cancel',
    });
  });
});

describe('actionAriaLabel', () => {
  it('starts with the visible text and names the slot', () => {
    expect(actionAriaLabel('cancel', 'Mon 12 Jan, 9:00 am')).toBe('Cancel, consultation on Mon 12 Jan, 9:00 am');
    expect(actionAriaLabel('complete', 'Mon 12 Jan, 9:00 am')).toBe(
      'Mark complete, consultation on Mon 12 Jan, 9:00 am',
    );
  });

  it('is undefined before the slot label is known, so the visible text is the name', () => {
    expect(actionAriaLabel('reschedule', '')).toBeUndefined();
  });
});

describe('groupByLocalDay', () => {
  it('groups slots by local day, keeping order', () => {
    const a = new Date(2030, 0, 10, 9, 0);
    const b = new Date(2030, 0, 10, 9, 15);
    const c2 = new Date(2030, 0, 11, 9, 0);
    const days = groupByLocalDay([a, b, c2]);
    expect([...days.keys()]).toEqual(['2030-01-10', '2030-01-11']);
    expect(days.get('2030-01-10')).toEqual([a, b]);
    expect(days.get('2030-01-11')).toEqual([c2]);
  });

  it('is empty for no slots', () => {
    expect(groupByLocalDay([]).size).toBe(0);
  });
});

describe('slotButtonState', () => {
  const slot = new Date('2030-01-12T00:00:00Z');
  const ms = slot.getTime();
  const at = slot.toISOString();

  it('is a plain enabled button by default', () => {
    expect(slotButtonState(slot, {})).toEqual({ isCurrent: false, isOccupied: false, disabled: false, selected: false });
  });

  it('is selected when it matches the value', () => {
    expect(slotButtonState(slot, { value: at }).selected).toBe(true);
  });

  it('is disabled and not selected when occupied', () => {
    const s = slotButtonState(slot, { value: at, occupied: new Set([ms]) });
    expect(s).toMatchObject({ isOccupied: true, disabled: true, selected: false });
  });

  it('treats the current slot as current, not occupied, even if it is in the occupied set', () => {
    const s = slotButtonState(slot, { currentIso: at, occupied: new Set([ms]) });
    expect(s).toMatchObject({ isCurrent: true, isOccupied: false, disabled: true, selected: false });
  });
});

describe('moreActionsAriaLabel', () => {
  it('includes the slot when known', () => {
    expect(moreActionsAriaLabel('Tue 24 Nov, 10:00 am')).toBe('More actions for consultation on Tue 24 Nov, 10:00 am');
  });

  it('is never blank before the slot label is known', () => {
    expect(moreActionsAriaLabel('')).toBe('More actions');
  });
});

describe('sectionPageHref', () => {
  it("sets one section's cursor and keeps the other sections' pages", () => {
    expect(sectionPageHref({ completed: 'c1', book: '1' }, 'cancelled', 'x2')).toBe(
      '/dashboard?completed=c1&cancelled=x2',
    );
  });
  it("drops the section's cursor for its first page", () => {
    expect(sectionPageHref({ completed: 'c1', cancelled: 'x2' }, 'completed', null)).toBe('/dashboard?cancelled=x2');
    expect(sectionPageHref({ upcoming: 'u1' }, 'upcoming', null)).toBe('/dashboard');
  });
  it('ignores repeated params and encodes cursors', () => {
    expect(sectionPageHref({ upcoming: ['a', 'b'] }, 'completed', 'a+b/=')).toBe('/dashboard?completed=a%2Bb%2F%3D');
  });
});
