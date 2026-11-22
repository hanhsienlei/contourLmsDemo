'use client'

import { useId, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { BOOKING_HELP, availableSlots } from '@/lib/consultations/rules'
import { dayKey, groupSlotsByPeriod, initialDay } from '@/lib/consultations/display'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TimeZoneNote } from './time-zone-note'
import { useMounted } from './use-mounted'

type Props = {
  value?: string
  onChange(iso: string): void
  now?: Date
  /** Epoch ms of slots the student already has booked. */
  occupied?: Set<number>
  /** The consultation's current time (reschedule); shown as "Current". */
  currentIso?: string
}

function groupByLocalDay(slots: Date[]): Map<string, Date[]> {
  const days = new Map<string, Date[]>()
  for (const slot of slots) {
    const key = dayKey(slot)
    days.set(key, [...(days.get(key) ?? []), slot])
  }
  return days
}

/** Day + time selects over the bookable window. `now` is read on the client after mount to avoid hydration drift. */
export function SlotPicker({ value, onChange, now, occupied, currentIso }: Props) {
  const mounted = useMounted()
  const id = useId()
  const days = useMemo(
    () => (mounted ? groupByLocalDay(availableSlots(now ?? new Date())) : null),
    [mounted, now],
  )
  const [pickedDay, setPickedDay] = useState<string>()
  if (!days) return <div className="h-9" aria-hidden />

  // Book mode starts with no day; reschedule defaults to the booking's day (or the first bookable one).
  const day =
    pickedDay ??
    (value ? dayKey(new Date(value)) : currentIso ? initialDay([...days.keys()], currentIso) : undefined)

  const times = (day && days.get(day)) || []

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="grid gap-1 sm:col-span-2">
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {BOOKING_HELP}
        </p>
        <TimeZoneNote />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${id}-day`}>Day</Label>
        <Select
          value={day ?? ''}
          onValueChange={(d) => {
            setPickedDay(d)
            onChange('')
          }}
        >
          <SelectTrigger id={`${id}-day`} className="w-full" aria-describedby={`${id}-hint`}>
            <SelectValue placeholder="Choose a day" />
          </SelectTrigger>
          <SelectContent>
            {[...days].map(([key, slots]) => (
              <SelectItem key={key} value={key}>
                {format(slots[0], 'EEE d MMM')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2 sm:col-span-2">
        <Label id={`${id}-time`}>Time</Label>
        {!day ? (
          <p className="text-sm text-muted-foreground">Choose a day first</p>
        ) : (
          <div role="group" aria-labelledby={`${id}-time`} className="grid gap-3">
            {groupSlotsByPeriod(times).map(({ period, slots }) => (
              <div key={period} className="grid gap-1.5">
                <p className="text-xs font-medium text-muted-foreground">{period}</p>
                <div className="flex flex-wrap gap-2">
                  {slots.map((slot) => {
                    const iso = slot.toISOString()
                    const ms = slot.getTime()
                    const isCurrent = currentIso !== undefined && Date.parse(currentIso) === ms
                    const isOccupied = !isCurrent && !!occupied?.has(ms)
                    const disabled = isCurrent || isOccupied
                    const selected = !disabled && !!value && Date.parse(value) === ms
                    const label = format(slot, 'h:mm aaa')
                    return (
                      <Button
                        key={iso}
                        type="button"
                        size="sm"
                        variant={selected ? 'default' : 'outline'}
                        aria-pressed={selected}
                        disabled={disabled}
                        title={
                          isCurrent
                            ? 'Your current time'
                            : isOccupied
                              ? 'You already have a booking at this time'
                              : undefined
                        }
                        className={isOccupied ? 'line-through' : undefined}
                        onClick={() => onChange(iso)}
                      >
                        {isCurrent ? `${label} · Current` : label}
                      </Button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
