import Link from 'next/link'
import { Lock } from 'lucide-react'
import { AdminConsultationTable } from '@/components/consultations/admin-consultation-table'
import { TimeZoneNote } from '@/components/consultations/time-zone-note'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { requireRolePage } from '@/lib/auth/guards'
import { parseAdminListQuery } from '@/lib/consultations/schema'
import { listAll } from '@/lib/consultations/service'

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
  const q = parseAdminListQuery({ cursor: sp.cursor, limit: PAGE_SIZE })
  if (!q) {
    return (
      <div className="grid gap-6">
        <h1 className="text-2xl font-semibold">All consultations</h1>
        <InvalidLink />
      </div>
    )
  }

  const { items, nextCursor } = await listAll(q)
  // Rendered once per request, so the current time is stable.
  const now = new Date()

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
      <AdminConsultationTable items={items} now={now} />
      {(q.cursor || nextCursor) && (
        <nav aria-label="Pagination" className="flex gap-2">
          {q.cursor && (
            <Button asChild variant="outline" size="sm">
              <Link href="/admin">First page</Link>
            </Button>
          )}
          {nextCursor && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/admin?cursor=${encodeURIComponent(nextCursor)}`}>Next page</Link>
            </Button>
          )}
        </nav>
      )}
    </div>
  )
}
