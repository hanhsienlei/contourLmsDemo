import Link from 'next/link'
import { AdminConsultationTable } from '@/components/consultations/admin-consultation-table'
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

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">All consultations</h1>
      <AdminConsultationTable items={items} />
      <nav aria-label="Pagination" className="flex gap-4">
        {q.cursor && (
          <Link href="/admin" className="underline underline-offset-4">
            First page
          </Link>
        )}
        {nextCursor && (
          <Link href={`/admin?cursor=${encodeURIComponent(nextCursor)}`} className="underline underline-offset-4">
            Next page
          </Link>
        )}
      </nav>
    </div>
  )
}
