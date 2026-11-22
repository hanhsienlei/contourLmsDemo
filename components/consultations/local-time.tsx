'use client'

import { formatSlot } from './format'
import { useMounted } from './use-mounted'

/** Renders a slot in the browser's timezone, avoiding a server/client hydration mismatch. */
export function LocalTime({ iso }: { iso: string }) {
  const mounted = useMounted()
  return (
    <time dateTime={iso} className="font-medium">
      {mounted ? formatSlot(iso) : ' '}
    </time>
  )
}
