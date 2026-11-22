import Link from 'next/link'
import { AdminConsultationTable } from '@/components/consultations/admin-consultation-table'
import { requireRolePage } from '@/lib/auth/guards'
import { adminListQuerySchema, decodeCursor, type Cursor } from '@/lib/consultations/schema'
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
  const parsed = adminListQuerySchema.safeParse({ cursor: sp.cursor, limit: PAGE_SIZE })
  let cursor: Cursor | undefined
  if (parsed.success && parsed.data.cursor !== undefined) {
    cursor = decodeCursor(parsed.data.cursor) ?? undefined
  }
  if (!parsed.success || (parsed.data.cursor !== undefined && !cursor)) {
    return (
      <div className="grid gap-6">
        <h1 className="text-2xl font-semibold">All consultations</h1>
        <InvalidLink />
      </div>
    )
  }

  const { items, nextCursor } = await listAll({ cursor, limit: PAGE_SIZE })

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">All consultations</h1>
      <AdminConsultationTable items={items} />
      <nav aria-label="Pagination" className="flex gap-4">
        {cursor && (
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
