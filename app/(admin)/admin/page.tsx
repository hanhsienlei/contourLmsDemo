import Link from 'next/link'
import { Lock } from 'lucide-react'
import { AdminConsultationTable } from '@/components/consultations/admin-consultation-table'
import { TimeZoneNote } from '@/components/consultations/time-zone-note'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { requireRolePage } from '@/lib/auth/guards'
import { ADMIN_TABS, adminPageHref } from '@/lib/consultations/display'
import { parseAdminListQuery } from '@/lib/consultations/schema'
import { countGroups, listAllGroup } from '@/lib/consultations/service'

const PAGE_SIZE = 20

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
      <nav aria-label="Consultation status" className="flex flex-wrap gap-2 border-b pb-3">
        {ADMIN_TABS.map((tab) => {
          const current = tab.group === group
          return (
            <Button key={tab.group} asChild variant={current ? 'secondary' : 'ghost'} size="sm">
              <Link href={adminPageHref(tab.group, null)} aria-current={current ? 'page' : undefined}>
                {tab.label}{' '}
                <Badge variant={current ? 'default' : 'outline'}>
                  {counts[tab.group]}
                  <span className="sr-only"> bookings</span>
                </Badge>
              </Link>
            </Button>
          )
        })}
      </nav>
      <AdminConsultationTable items={items} now={now} />
      {(q.cursor || nextCursor) && (
        <nav aria-label="Pagination" className="flex gap-2">
          {q.cursor && (
            <Button asChild variant="outline" size="sm">
              <Link href={adminPageHref(group, null)}>First page</Link>
            </Button>
          )}
          {nextCursor && (
            <Button asChild variant="outline" size="sm">
              <Link href={adminPageHref(group, nextCursor)}>Next page</Link>
            </Button>
          )}
        </nav>
      )}
    </div>
  )
}
