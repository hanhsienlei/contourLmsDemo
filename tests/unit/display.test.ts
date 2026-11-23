import { describe, it, expect } from 'vitest';
import {
  DISPLAY_STATE_LABEL,
  displayState,
  groupForStudent,
  relativeTime,
  timeZoneLabel,
  slotPeriod,
  groupSlotsByPeriod,
  dayKey,
  initialDay,
  activeSlotKeys,
  prefillName,
  actionsFor,
  rowLayout,
  ROW_ACTION_LABEL,
  actionAriaLabel,
  groupByLocalDay,
  slotButtonState,
  moreActionsAriaLabel,
} from '@/lib/consultations/display';
import type { ConsultationStatus } from '@/lib/consultations/rules';

const now = new Date('2030-01-10T00:00:00Z');
const MIN = 60_000;
const DAY = 24 * 60 * MIN;

const iso = (offsetMs: number) => new Date(now.getTime() + offsetMs).toISOString();
const c = (id: string, status: ConsultationStatus, scheduledAt: string) => ({ id, status, scheduledAt });
const ids = (items: { id: string }[]) => items.map((i) => i.id);

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

describe('groupForStudent', () => {
  it('groups the seeded Alice rows by display state', () => {
    // Mirrors scripts/seed.ts: Alice's rows as offsets from now.
    const items = [
      c('methods', 'scheduled', iso(2 * DAY)),
      c('english', 'scheduled', iso(5 * DAY)),
      c('chem', 'scheduled', iso(-3 * DAY)),
      c('term3', 'completed', iso(-7 * DAY)),
      c('specialist', 'completed', iso(4 * DAY)),
      c('physics', 'cancelled', iso(5 * DAY)),
    ];
    const g = groupForStudent(items, now);
    expect(ids(g.needsUpdate)).toEqual(['chem']);
    expect(ids(g.upcoming)).toEqual(['methods', 'english']);
    expect(ids(g.history.completed)).toEqual(['specialist', 'term3']);
    expect(ids(g.history.cancelled)).toEqual(['physics']);
  });

  it('sorts upcoming soonest first and the rest most recent first', () => {
    const items = [
      c('u2', 'scheduled', iso(2 * DAY)),
      c('u1', 'scheduled', iso(DAY)),
      c('n2', 'scheduled', iso(-2 * DAY)),
      c('n1', 'scheduled', iso(-DAY)),
      c('d2', 'completed', iso(-2 * DAY)),
      c('d1', 'completed', iso(DAY)),
      c('x2', 'cancelled', iso(-2 * DAY)),
      c('x1', 'cancelled', iso(-DAY)),
    ];
    const g = groupForStudent(items, now);
    expect(ids(g.upcoming)).toEqual(['u1', 'u2']);
    expect(ids(g.needsUpdate)).toEqual(['n1', 'n2']);
    expect(ids(g.history.completed)).toEqual(['d1', 'd2']);
    expect(ids(g.history.cancelled)).toEqual(['x1', 'x2']);
  });

  it('breaks ties on the same instant by id', () => {
    const at = iso(DAY);
    const g = groupForStudent([c('b', 'cancelled', at), c('a', 'cancelled', at)], now);
    expect(ids(g.history.cancelled)).toEqual(['a', 'b']);
  });

  it('sorts by instant across offsets, not by string', () => {
    const g = groupForStudent(
      [c('z', 'scheduled', '2030-01-11T23:30:00Z'), c('plus10', 'scheduled', '2030-01-12T09:00:00+10:00')],
      now,
    );
    expect(ids(g.upcoming)).toEqual(['plus10', 'z']);
  });

  it('returns empty groups for no items', () => {
    expect(groupForStudent([], now)).toEqual({
      needsUpdate: [],
      upcoming: [],
      history: { completed: [], cancelled: [] },
    });
  });

  it('does not mutate input', () => {
    const items = [c('u2', 'scheduled', iso(2 * DAY)), c('u1', 'scheduled', iso(DAY))];
    const before = ids(items);
    groupForStudent(items, now);
    expect(ids(items)).toEqual(before);
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

describe('activeSlotKeys', () => {
  it('holds scheduled and completed instants, not cancelled', () => {
    const keys = activeSlotKeys([
      { status: 'scheduled', scheduledAt: '2030-01-12T00:00:00Z' },
      { status: 'completed', scheduledAt: '2030-01-13T00:00:00Z' },
      { status: 'cancelled', scheduledAt: '2030-01-14T00:00:00Z' },
    ]);
    expect(keys.has(Date.parse('2030-01-12T00:00:00Z'))).toBe(true);
    expect(keys.has(Date.parse('2030-01-13T00:00:00Z'))).toBe(true);
    expect(keys.has(Date.parse('2030-01-14T00:00:00Z'))).toBe(false);
  });

  it('keys the same instant identically across formats', () => {
    const a = activeSlotKeys([{ status: 'scheduled', scheduledAt: '2030-01-12T00:00:00+00:00' }]);
    const b = activeSlotKeys([{ status: 'scheduled', scheduledAt: '2030-01-12T00:00:00.000Z' }]);
    expect([...a]).toEqual([...b]);
  });
});

describe('prefillName', () => {
  it('uses the most recently created row whatever its status', () => {
    expect(
      prefillName([
        { firstName: 'Old', lastName: 'Row', createdAt: '2030-01-01T00:00:00Z' },
        { firstName: 'New', lastName: 'Row', createdAt: '2030-01-05T00:00:00Z' },
        { firstName: 'Mid', lastName: 'Row', createdAt: '2030-01-03T00:00:00Z' },
      ]),
    ).toEqual({ firstName: 'New', lastName: 'Row' });
  });

  it('is empty with no rows', () => {
    expect(prefillName([])).toEqual({ firstName: '', lastName: '' });
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
