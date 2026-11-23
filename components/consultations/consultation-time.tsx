'use client'

import { relativeTime } from '@/lib/consultations/display'
import { formatSlot } from './format'
import { useMounted } from './use-mounted'

/**
 * Absolute slot (the `<time>` element) plus relative time in the browser's timezone; blank until
 * mounted so hydration agrees. `note` ends the second line (e.g. "Did this happen?").
 */
export function ConsultationTime({ iso, note }: { iso: string; note?: string }) {
  const mounted = useMounted()
  return (
    <div className="grid">
      <time dateTime={iso} className="text-sm">
        {mounted ? formatSlot(iso) : ' '}
      </time>
      <span className="text-sm text-muted-foreground">
        {mounted ? relativeTime(iso, new Date()) : ' '}
        {mounted && note && (
          <>
            <span aria-hidden="true"> · </span>
            {note}
          </>
        )}
      </span>
    </div>
  )
}
