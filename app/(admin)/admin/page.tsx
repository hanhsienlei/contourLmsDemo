import Link from 'next/link'
import { Lock } from 'lucide-react'
import {
  adminReasonColumn,
  statusColumn,
  studentColumn,
  timeColumn,
} from '@/components/consultations/consultation-columns'
import { ConsultationTable } from '@/components/consultations/consultation-table'
import { ListPager, ListTabs } from '@/components/consultations/list-nav'
import { TimeZoneNote } from '@/components/consultations/time-zone-note'
import { Badge } from '@/components/ui/badge'
import { requireRolePage } from '@/lib/auth/guards'
import { parseAdminListQuery } from '@/lib/consultations/schema'
import { countGroups, listAllGroup } from '@/lib/consultations/service'

const PAGE_SIZE = 20

/** Read-only: no actions column. */
const COLUMNS = [timeColumn, studentColumn, adminReasonColumn, statusColumn]

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

function InvalidLink() {
  return (
    <div role="alert" className="grid gap-2">
      <p>Invalid page link.</p>
      <Link href="/admin" className="underline underline-offset-4">
        Back to first page
      </Link>
    </div>
  )
}

export default async function AdminPage({ searchParams }: { searchParams: SearchParams }) {
  await requireRolePage('admin')

  const sp = await searchParams
  const q = parseAdminListQuery({ group: sp.group, cursor: sp.cursor, limit: PAGE_SIZE })
  if (!q) {
    return (
      <div className="grid gap-6">
        <h1 className="text-2xl font-semibold">All consultations</h1>
        <InvalidLink />
      </div>
    )
  }

  const group = q.group ?? 'upcoming'
  // One clock for the tab, its counts and the rows' display state.
  const now = new Date()
  const [{ items, nextCursor }, counts] = await Promise.all([
    listAllGroup({ group, cursor: q.cursor, limit: q.limit }, now),
    countGroups({}, now),
  ])

  return (
    <div className="grid gap-6">
      <header className="grid gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">All consultations</h1>
          <Badge variant="secondary">Admin</Badge>
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Lock className="size-4" aria-hidden />
            Read-only
          </span>
        </div>
        <TimeZoneNote />
      </header>
      <ListTabs base="/admin" current={group} counts={counts} />
      <ConsultationTable items={items} now={now} columns={COLUMNS} caption="All consultations" />
      <ListPager base="/admin" group={group} onLaterPage={!!q.cursor} nextCursor={nextCursor} />
    </div>
  )
}
