import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  LIST_TABS,
  listPageHref,
  tabNeedsAttention,
  type DisplayState,
  type ListPath,
} from '@/lib/consultations/display'

/** Status tabs with counts, as links so the URL is shareable (spec §6.1, §6.5). */
export function ListTabs({
  base,
  current,
  counts,
}: {
  base: ListPath
  current: DisplayState
  counts: Record<DisplayState, number>
}) {
  return (
    <nav aria-label="Consultation status" className="flex flex-wrap gap-2 border-b pb-3">
      {LIST_TABS.map((tab) => {
        const isCurrent = tab.group === current
        return (
          <Button key={tab.group} asChild variant={isCurrent ? 'secondary' : 'ghost'} size="sm">
            <Link href={listPageHref(base, tab.group, null)} aria-current={isCurrent ? 'page' : undefined}>
              {tabNeedsAttention(tab.group, counts[tab.group]) && (
                <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" aria-hidden />
              )}
              {tab.label}{' '}
              <Badge variant={isCurrent ? 'default' : 'outline'}>
                {counts[tab.group]}
                <span className="sr-only"> bookings</span>
              </Badge>
            </Link>
          </Button>
        )
      })}
    </nav>
  )
}

/** First page / Next page within the current tab; renders nothing on a single page. */
export function ListPager({
  base,
  group,
  onLaterPage,
  nextCursor,
}: {
  base: ListPath
  group: DisplayState
  onLaterPage: boolean
  nextCursor: string | null
}) {
  if (!onLaterPage && !nextCursor) return null
  return (
    <nav aria-label="Pagination" className="flex gap-2">
      {onLaterPage && (
        <Button asChild variant="outline" size="sm">
          <Link href={listPageHref(base, group, null)}>First page</Link>
        </Button>
      )}
      {nextCursor && (
        <Button asChild variant="outline" size="sm">
          <Link href={listPageHref(base, group, nextCursor)}>Next page</Link>
        </Button>
      )}
    </nav>
  )
}
