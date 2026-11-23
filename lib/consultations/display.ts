import { format, formatDistanceStrict } from 'date-fns'
import { STUDENT_GROUPS, type StudentGroup } from './schema'
import type { Consultation } from './types'

/**
 * How a consultation is presented, derived from status and time.
 * Display only: a past `scheduled` booking can still be cancelled through
 * the API (spec D1); the UI just puts Mark complete and Reschedule first.
 */
export type DisplayState = StudentGroup

export const DISPLAY_STATE_LABEL: Record<DisplayState, string> = {
  upcoming: 'Scheduled',
  needs_update: 'Past, not marked',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

type Timed = Pick<Consultation, 'status' | 'scheduledAt'>

export function displayState(item: Timed, now: Date): DisplayState {
  if (item.status === 'completed') return 'completed'
  if (item.status === 'cancelled') return 'cancelled'
  return Date.parse(item.scheduledAt) >= now.getTime() ? 'upcoming' : 'needs_update'
}

/** "in 2 days", "3 hours ago". */
export function relativeTime(iso: string, now: Date): string {
  return formatDistanceStrict(new Date(iso), now, { addSuffix: true })
}

/** e.g. "Adelaide time (ACDT)". Falls back to the raw name, or "your local time" when unknown. */
export function timeZoneLabel(timeZone: string | undefined, at: Date): string {
  if (!timeZone) return 'your local time'
  try {
    const abbreviation = new Intl.DateTimeFormat('en-AU', { timeZone, timeZoneName: 'short' })
      .formatToParts(at)
      .find((p) => p.type === 'timeZoneName')?.value
    const city = timeZone.split('/').pop()!.replaceAll('_', ' ')
    return abbreviation ? `${city} time (${abbreviation})` : `${city} time`
  } catch {
    return timeZone
  }
}

export type DayPeriod = 'Morning' | 'Afternoon' | 'Evening'

const PERIODS: DayPeriod[] = ['Morning', 'Afternoon', 'Evening']

export function slotPeriod(d: Date): DayPeriod {
  const hour = d.getHours()
  if (hour < 12) return 'Morning'
  return hour < 17 ? 'Afternoon' : 'Evening'
}

export function groupSlotsByPeriod(slots: readonly Date[]): { period: DayPeriod; slots: Date[] }[] {
  const by: Record<DayPeriod, Date[]> = { Morning: [], Afternoon: [], Evening: [] }
  for (const slot of slots) by[slotPeriod(slot)].push(slot)
  return PERIODS.filter((period) => by[period].length > 0).map((period) => ({ period, slots: by[period] }))
}

/** Local calendar day as yyyy-MM-dd. */
export const dayKey = (d: Date): string => format(d, 'yyyy-MM-dd')

/** Slots grouped by local calendar day (`dayKey`), in input order. */
export function groupByLocalDay(slots: readonly Date[]): Map<string, Date[]> {
  const days = new Map<string, Date[]>()
  for (const slot of slots) {
    const key = dayKey(slot)
    const list = days.get(key)
    if (list) list.push(slot)
    else days.set(key, [slot])
  }
  return days
}

export type SlotButtonState = {
  /** The booking's own time when rescheduling. */
  isCurrent: boolean
  /** Another of the student's active bookings is at this time. */
  isOccupied: boolean
  disabled: boolean
  selected: boolean
}

/** How one time button in the slot picker is shown. The current slot is never also "occupied". */
export function slotButtonState(
  slot: Date,
  { value, currentIso, occupied }: { value?: string; currentIso?: string; occupied?: ReadonlySet<number> },
): SlotButtonState {
  const ms = slot.getTime()
  const isCurrent = currentIso !== undefined && Date.parse(currentIso) === ms
  const isOccupied = !isCurrent && !!occupied?.has(ms)
  const disabled = isCurrent || isOccupied
  const selected = !disabled && !!value && Date.parse(value) === ms
  return { isCurrent, isOccupied, disabled, selected }
}

/** The day to show first: the current booking's day if offered, else the first offered day. */
export function initialDay(dayKeys: readonly string[], currentIso?: string): string | undefined {
  if (currentIso) {
    const current = dayKey(new Date(currentIso))
    if (dayKeys.includes(current)) return current
  }
  return dayKeys[0]
}

export type RowAction = 'complete' | 'incomplete' | 'reschedule' | 'cancel'

/** Visible text of each row action's button or menu item. */
export const ROW_ACTION_LABEL: Record<RowAction, string> = {
  complete: 'Mark complete',
  incomplete: 'Mark incomplete',
  reschedule: 'Reschedule',
  cancel: 'Cancel',
}

/**
 * Accessible name for a row action: the visible text first, then the slot, so voice control still
 * matches what is on screen. Undefined until the slot label is known (the visible text is the name).
 */
export function actionAriaLabel(action: RowAction, slotLabel: string): string | undefined {
  return slotLabel ? `${ROW_ACTION_LABEL[action]}, consultation on ${slotLabel}` : undefined
}

/** Accessible name for a row's ⋯ menu. Plain "More actions" until the slot label is known. */
export function moreActionsAriaLabel(slotLabel: string): string {
  return slotLabel ? `More actions for consultation on ${slotLabel}` : 'More actions'
}

/** Row actions for a display state. The primary action is `visible[0]`; `menu` holds the rest. */
export function actionsFor(state: DisplayState): { visible: RowAction[]; menu: RowAction[] } {
  switch (state) {
    case 'upcoming':
      return { visible: ['complete', 'reschedule', 'cancel'], menu: [] }
    case 'needs_update':
      return { visible: ['complete', 'reschedule'], menu: ['cancel'] }
    case 'completed':
      return { visible: ['incomplete'], menu: [] }
    case 'cancelled':
      return { visible: [], menu: [] }
  }
}

export type ActionVariant = 'default' | 'outline' | 'ghost'

/**
 * Button style of a row action (spec §4). At most one filled ('default') action per row: what the
 * student most likely wants next. Reschedule before the booking, Mark complete after it.
 */
export function actionVariant(state: DisplayState, action: RowAction): ActionVariant {
  if (state === 'upcoming' && action === 'reschedule') return 'default'
  if (state === 'needs_update' && action === 'complete') return 'default'
  if (state === 'upcoming' && action === 'cancel') return 'ghost'
  if (action === 'incomplete') return 'ghost'
  return 'outline'
}

/** Actions that open a dialog (the others run inline). */
export type DialogAction = Extract<RowAction, 'reschedule' | 'cancel'>
const isDialogAction = (a: RowAction): a is DialogAction => a === 'reschedule' || a === 'cancel'

export type RowLayout = {
  primary?: RowAction
  /** Dialog buttons from `sm` up, mirrored as menu items below `sm`. */
  secondary: DialogAction[]
  /** Dialog actions that appear only in the ⋯ menu. */
  menuOnly: DialogAction[]
  /** When the ⋯ trigger shows: never, below `sm` (mirrored items only), or always (has menu-only items). */
  menuVisibility: 'never' | 'below-sm' | 'always'
}

/** How a row lays out its actions between visible buttons and the ⋯ menu. */
export function rowLayout(state: DisplayState): RowLayout {
  const { visible, menu } = actionsFor(state)
  const [primary, ...secondary] = visible
  const dialogSecondary = secondary.filter(isDialogAction)
  const menuOnly = menu.filter(isDialogAction)
  const menuVisibility = menuOnly.length > 0 ? 'always' : dialogSecondary.length > 0 ? 'below-sm' : 'never'
  return { primary, secondary: dialogSecondary, menuOnly, menuVisibility }
}

/**
 * Dashboard link to one page of one section (null: its first page). Other sections keep
 * the page they are on; anything else in the query (such as `book=1`) is dropped.
 */
export function sectionPageHref(
  current: Readonly<Record<string, string | string[] | undefined>>,
  section: DisplayState,
  cursor: string | null,
): string {
  const params = new URLSearchParams()
  for (const group of STUDENT_GROUPS) {
    const value = group === section ? cursor : current[group]
    if (typeof value === 'string' && value) params.set(group, value)
  }
  const query = params.toString()
  return query ? `/dashboard?${query}` : '/dashboard'
}
