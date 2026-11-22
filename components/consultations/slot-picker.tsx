'use client'

import { useId, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { availableSlots } from '@/lib/consultations/rules'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useMounted } from './use-mounted'

type Props = {
  value?: string
  onChange(iso: string): void
  now?: Date
}

const dayKey = (d: Date) => format(d, 'yyyy-MM-dd')

function groupByLocalDay(slots: Date[]): Map<string, Date[]> {
  const days = new Map<string, Date[]>()
  for (const slot of slots) {
    const key = dayKey(slot)
    days.set(key, [...(days.get(key) ?? []), slot])
  }
  return days
}

/** Day + time selects over the bookable window. `now` is read on the client after mount to avoid hydration drift. */
export function SlotPicker({ value, onChange, now }: Props) {
  const mounted = useMounted()
  const id = useId()
  const days = useMemo(
    () => (mounted ? groupByLocalDay(availableSlots(now ?? new Date())) : null),
    [mounted, now],
  )
  const [pickedDay, setPickedDay] = useState<string>()
  const day = pickedDay ?? (value ? dayKey(new Date(value)) : undefined)

  if (!days) return <div className="h-9" aria-hidden />

  const times = (day && days.get(day)) || []

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <p id={`${id}-hint`} className="text-sm text-muted-foreground sm:col-span-2">
        Consultations run 8:00 am to 8:00 pm Melbourne time, booked 1 to 14 days ahead. Times are shown in your local time.
      </p>
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
      <div className="grid gap-2">
        <Label htmlFor={`${id}-time`}>Time</Label>
        <Select value={value ?? ''} onValueChange={onChange} disabled={!day}>
          <SelectTrigger id={`${id}-time`} className="w-full">
            <SelectValue placeholder="Choose a time" />
          </SelectTrigger>
          <SelectContent>
            {times.map((slot) => (
              <SelectItem key={slot.toISOString()} value={slot.toISOString()}>
                {format(slot, 'h:mm aaa')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
