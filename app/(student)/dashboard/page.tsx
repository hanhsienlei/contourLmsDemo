import Link from 'next/link'
import { BookConsultationButton } from '@/components/consultations/book-consultation-button'
import { TimeZoneNote } from '@/components/consultations/time-zone-note'
import { ConsultationList } from '@/components/consultations/consultation-list'
import { requireRolePage } from '@/lib/auth/guards'
import { STUDENT_GROUPS, parseStudentListQuery, type StudentGroup } from '@/lib/consultations/schema'
import { getProfileName, listActiveSlots, listOwnGroup } from '@/lib/consultations/service'

const PAGE_SIZE = 20

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const { userId } = await requireRolePage('student')
  const sp = await searchParams

  // Each section pages on its own; its cursor is the query param named after it.
  const queries = STUDENT_GROUPS.map((group) => parseStudentListQuery({ group, cursor: sp[group], limit: PAGE_SIZE }))
  if (queries.some((q) => q === null)) {
    return (
      <div role="alert" className="grid gap-2">
        <p>Invalid page link.</p>
        <Link href="/dashboard" className="underline underline-offset-4">
          Back to your consultations
        </Link>
      </div>
    )
  }

  // One clock for every query and for the rows' display state.
  const now = new Date()
  const [pages, occupied, defaults] = await Promise.all([
    Promise.all(queries.map((q) => listOwnGroup(userId, q!, now))),
    listActiveSlots(userId, now),
    getProfileName(userId),
  ])
  const groups = Object.fromEntries(STUDENT_GROUPS.map((g, i) => [g, pages[i]])) as Record<
    StudentGroup,
    (typeof pages)[number]
  >

  return (
    <div className="grid gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold">Your consultations</h1>
          <TimeZoneNote />
        </div>
        <BookConsultationButton openOnLoad={sp.book === '1'} occupied={occupied} defaults={defaults} />
      </div>
      <ConsultationList groups={groups} searchParams={sp} occupied={occupied} defaults={defaults} />
    </div>
  )
}
