'use client'

import { formatSlot } from './format'
import { useMounted } from './use-mounted'

/** Slot label in the browser's timezone; '' until mounted so SSR and hydration agree. */
export function useSlotLabel(iso: string): string {
  const mounted = useMounted()
  return mounted ? formatSlot(iso) : ''
}

/** Renders a slot in the browser's timezone, avoiding a server/client hydration mismatch. */
export function LocalTime({ iso }: { iso: string }) {
  const label = useSlotLabel(iso)
  return (
    <time dateTime={iso} className="font-medium">
      {label || ' '}
    </time>
  )
}
