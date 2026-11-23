import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { badgeVariants } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { sectionPageHref, type DisplayState } from '@/lib/consultations/display'
import type { Consultation, Page, StudentName } from '@/lib/consultations/types'
import { BookConsultationButton } from './book-consultation-button'
import { CancelledToggle } from './cancelled-toggle'
import { ConsultationRow } from './consultation-row'

type SearchParams = Record<string, string | string[] | undefined>

type BookProps = {
  /** Epoch ms of the student's active slots. */
  occupied: number[]
  defaults: StudentName
}

function Rows({
  items,
  state,
  note,
  occupied,
}: {
  items: Consultation[]
  state: DisplayState
  note?: string
  occupied: number[]
}) {
  return items.map((item) => (
    <ConsultationRow key={item.id} item={item} state={state} note={note} occupied={occupied} />
  ))
}

/** First page / Next page links for one section, shown only when it has more than one page. */
function SectionPager({
  section,
  label,
  page,
  searchParams,
}: {
  section: DisplayState
  label: string
  page: Page<Consultation>
  searchParams: SearchParams
}) {
  const onLaterPage = typeof searchParams[section] === 'string'
  if (!onLaterPage && !page.nextCursor) return null
  return (
    <nav aria-label={`${label} pages`} className="flex gap-2">
      {onLaterPage && (
        <Button asChild variant="outline" size="sm">
          <Link href={sectionPageHref(searchParams, section, null)} scroll={false}>
            First page
          </Link>
        </Button>
      )}
      {page.nextCursor && (
        <Button asChild variant="outline" size="sm">
          <Link href={sectionPageHref(searchParams, section, page.nextCursor)} scroll={false}>
            Next page
          </Link>
        </Button>
      )}
    </nav>
  )
}

export function ConsultationList({
  groups,
  searchParams,
  occupied,
  defaults,
}: { groups: Record<DisplayState, Page<Consultation>>; searchParams: SearchParams } & BookProps) {
  const bookButton = <BookConsultationButton occupied={occupied} defaults={defaults} />
  const { needs_update: needsUpdate, upcoming, completed, cancelled } = groups

  if (needsUpdate.total + upcoming.total + completed.total + cancelled.total === 0) {
    return (
      <Card>
        <CardContent className="grid justify-items-center gap-3 p-8 text-center">
          <h2 className="text-lg font-semibold">Book your first consultation</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            A consultation is a one-on-one session with a tutor to talk through your study questions.
          </p>
          {bookButton}
        </CardContent>
      </Card>
    )
  }

  const pager = (section: DisplayState, label: string) => (
    <SectionPager section={section} label={label} page={groups[section]} searchParams={searchParams} />
  )

  return (
    <div className="grid gap-8">
      {needsUpdate.total > 0 && (
        <section className="grid gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <AlertTriangle className="size-5 text-amber-600 dark:text-amber-400" aria-hidden />
            Needs your update
          </h2>
          <ul className="grid gap-3">
            <Rows items={needsUpdate.items} state="needs_update" note="Did this happen?" occupied={occupied} />
          </ul>
          {pager('needs_update', 'Needs your update')}
        </section>
      )}
      <section className="grid gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          Upcoming <span className={badgeVariants({ variant: 'secondary' })}>{upcoming.total}</span>
        </h2>
        {upcoming.total === 0 ? (
          <div className="grid justify-items-start gap-3">
            <p className="text-sm text-muted-foreground">Nothing booked yet</p>
            {bookButton}
          </div>
        ) : (
          <ul className="grid gap-3">
            <Rows items={upcoming.items} state="upcoming" occupied={occupied} />
          </ul>
        )}
        {pager('upcoming', 'Upcoming')}
      </section>
      {completed.total + cancelled.total > 0 && (
        <section className="grid gap-3">
          <h2 className="text-lg font-semibold">History</h2>
          {completed.total > 0 && (
            <>
              <ul className="grid gap-3">
                <Rows items={completed.items} state="completed" occupied={occupied} />
              </ul>
              {pager('completed', 'Completed')}
            </>
          )}
          {cancelled.total > 0 && (
            // Open already when the student is paging through cancelled rows.
            <CancelledToggle
              count={cancelled.total}
              defaultOpen={typeof searchParams.cancelled === 'string'}
              footer={pager('cancelled', 'Cancelled')}
            >
              <Rows items={cancelled.items} state="cancelled" occupied={occupied} />
            </CancelledToggle>
          )}
        </section>
      )}
    </div>
  )
}
