import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { groupForStudent, type DisplayState } from '@/lib/consultations/display'
import type { Consultation } from '@/lib/consultations/service'
import { CancelledToggle } from './cancelled-toggle'
import { ConsultationRow } from './consultation-row'

function BookButton({ children = 'Book a consultation' }: { children?: React.ReactNode }) {
  return (
    <Button asChild>
      <Link href="/consultations/new">{children}</Link>
    </Button>
  )
}

function Rows({ items, state, note }: { items: Consultation[]; state: DisplayState; note?: string }) {
  return items.map((item) => <ConsultationRow key={item.id} item={item} state={state} note={note} />)
}

export function ConsultationList({ items }: { items: Consultation[] }) {
  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="grid justify-items-center gap-3 p-8 text-center">
          <h2 className="text-lg font-semibold">Book your first consultation</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            A consultation is a one-on-one session with a tutor to talk through your study questions.
          </p>
          <BookButton />
        </CardContent>
      </Card>
    )
  }

  // Server component: rendered once per request, so the current time is stable.
  // eslint-disable-next-line react-hooks/purity
  const now = new Date(Date.now())
  const { needsUpdate, upcoming, history } = groupForStudent(items, now)
  const showHistory = history.completed.length > 0 || history.cancelled.length > 0

  return (
    <div className="grid gap-8">
      {needsUpdate.length > 0 && (
        <section className="grid gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <AlertTriangle className="size-5 text-amber-600 dark:text-amber-400" aria-hidden />
            Needs your update
          </h2>
          <ul className="grid gap-3">
            <Rows items={needsUpdate} state="needs_update" note="Did this happen?" />
          </ul>
        </section>
      )}
      <section className="grid gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          Upcoming <Badge variant="secondary">{upcoming.length}</Badge>
        </h2>
        {upcoming.length === 0 ? (
          <div className="grid justify-items-start gap-3">
            <p className="text-sm text-muted-foreground">Nothing booked yet</p>
            <BookButton />
          </div>
        ) : (
          <ul className="grid gap-3">
            <Rows items={upcoming} state="upcoming" />
          </ul>
        )}
      </section>
      {showHistory && (
        <section className="grid gap-3">
          <h2 className="text-lg font-semibold">History</h2>
          {history.completed.length > 0 && (
            <ul className="grid gap-3">
              <Rows items={history.completed} state="completed" />
            </ul>
          )}
          {history.cancelled.length > 0 && (
            <CancelledToggle count={history.cancelled.length}>
              <Rows items={history.cancelled} state="cancelled" />
            </CancelledToggle>
          )}
        </section>
      )}
    </div>
  )
}
