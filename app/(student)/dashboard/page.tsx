import Link from 'next/link'
import { BookConsultationButton } from '@/components/consultations/book-consultation-button'
import {
  actionsColumn,
  statusColumn,
  studentReasonColumn,
  timeColumn,
} from '@/components/consultations/consultation-columns'
import { ConsultationTable } from '@/components/consultations/consultation-table'
import { ListPager, ListTabs } from '@/components/consultations/list-nav'
import { TimeZoneNote } from '@/components/consultations/time-zone-note'
import { Card, CardContent } from '@/components/ui/card'
import { requireRolePage } from '@/lib/auth/guards'
import { parseStudentListQuery } from '@/lib/consultations/schema'
import { countGroups, getProfileName, listActiveSlots, listOwnGroup } from '@/lib/consultations/service'

const PAGE_SIZE = 20

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const { userId } = await requireRolePage('student')
  const sp = await searchParams

  const q = parseStudentListQuery({ group: sp.group ?? 'upcoming', cursor: sp.cursor, limit: PAGE_SIZE })
  if (!q) {
    return (
      <div role="alert" className="grid gap-2">
        <p>Invalid page link.</p>
        <Link href="/dashboard" className="underline underline-offset-4">
          Back to your consultations
        </Link>
      </div>
    )
  }

  // One clock for the tab, its counts and the rows' display state.
  const now = new Date()
  const [{ items, nextCursor }, counts, occupied, defaults] = await Promise.all([
    listOwnGroup(userId, q, now),
    countGroups({ userId }, now),
    listActiveSlots(userId, now),
    getProfileName(userId),
  ])
  const hasAny = Object.values(counts).some((n) => n > 0)
  // The student's view adds the actions column and leaves out the student column.
  const columns = [timeColumn, studentReasonColumn(occupied), statusColumn, actionsColumn(occupied)]

  return (
    <div className="grid gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold">Your consultations</h1>
          <TimeZoneNote />
        </div>
        <BookConsultationButton openOnLoad={sp.book === '1'} occupied={occupied} defaults={defaults} />
      </div>
      {hasAny ? (
        <>
          <ListTabs base="/dashboard" current={q.group} counts={counts} />
          <ConsultationTable items={items} now={now} columns={columns} caption="Your consultations" />
          <ListPager base="/dashboard" group={q.group} onLaterPage={!!q.cursor} nextCursor={nextCursor} />
        </>
      ) : (
        <Card>
          <CardContent className="grid justify-items-center gap-3 p-8 text-center">
            <h2 className="text-lg font-semibold">Book your first consultation</h2>
            <p className="max-w-md text-sm text-muted-foreground">
              A consultation is a one-on-one session with a tutor to talk through your study questions.
            </p>
            <BookConsultationButton occupied={occupied} defaults={defaults} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
