'use client'

import { relativeTime } from '@/lib/consultations/display'
import { formatSlot } from './format'
import { useMounted } from './use-mounted'

/**
 * Absolute slot plus relative time in the browser's timezone; blank until mounted so hydration agrees.
 * `note` ends the second line (e.g. "Did this happen?").
 */
export function ConsultationTime({ iso, note }: { iso: string; note?: string }) {
  const mounted = useMounted()
  return (
    <time dateTime={iso} className="grid">
      <span className="font-medium">{mounted ? formatSlot(iso) : ' '}</span>
      <span className="text-sm text-muted-foreground">
        {mounted ? relativeTime(iso, new Date()) : ' '}
        {note && <> · {note}</>}
      </span>
    </time>
  )
}
