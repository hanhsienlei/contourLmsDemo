'use client'

import { Clock } from 'lucide-react'
import { timeZoneLabel } from '@/lib/consultations/display'
import { useMounted } from './use-mounted'

/** One muted line naming the browser's timezone; blank until mounted so hydration agrees. */
export function TimeZoneNote() {
  const mounted = useMounted()
  if (!mounted) return <p className="min-h-5 text-sm text-muted-foreground" />
  const label = timeZoneLabel(Intl.DateTimeFormat().resolvedOptions().timeZone, new Date())
  return (
    <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <Clock className="size-4" aria-hidden />
      Times in {label}
    </p>
  )
}
