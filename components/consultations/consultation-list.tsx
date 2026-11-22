import { AlertTriangle } from 'lucide-react'
import { badgeVariants } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { groupForStudent, type DisplayState } from '@/lib/consultations/display'
import type { Consultation } from '@/lib/consultations/service'
import { BookConsultationButton } from './book-consultation-button'
import { CancelledToggle } from './cancelled-toggle'
import { ConsultationRow } from './consultation-row'

type BookProps = {
  /** Epoch ms of the student's active slots. */
  occupied: number[]
  defaults: { firstName: string; lastName: string }
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

export function ConsultationList({ items, occupied, defaults }: { items: Consultation[] } & BookProps) {
  const bookButton = <BookConsultationButton occupied={occupied} defaults={defaults} />

  if (items.length === 0) {
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
            <Rows items={needsUpdate} state="needs_update" note="Did this happen?" occupied={occupied} />
          </ul>
        </section>
      )}
      <section className="grid gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          Upcoming <span className={badgeVariants({ variant: 'secondary' })}>{upcoming.length}</span>
        </h2>
        {upcoming.length === 0 ? (
          <div className="grid justify-items-start gap-3">
            <p className="text-sm text-muted-foreground">Nothing booked yet</p>
            {bookButton}
          </div>
        ) : (
          <ul className="grid gap-3">
            <Rows items={upcoming} state="upcoming" occupied={occupied} />
          </ul>
        )}
      </section>
      {showHistory && (
        <section className="grid gap-3">
          <h2 className="text-lg font-semibold">History</h2>
          {history.completed.length > 0 && (
            <ul className="grid gap-3">
              <Rows items={history.completed} state="completed" occupied={occupied} />
            </ul>
          )}
          {history.cancelled.length > 0 && (
            <CancelledToggle count={history.cancelled.length}>
              <Rows items={history.cancelled} state="cancelled" occupied={occupied} />
            </CancelledToggle>
          )}
        </section>
      )}
    </div>
  )
}
