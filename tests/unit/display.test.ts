import { describe, it, expect } from 'vitest';
import { DISPLAY_STATE_LABEL, displayState, groupForStudent } from '@/lib/consultations/display';
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
