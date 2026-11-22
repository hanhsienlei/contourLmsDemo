import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { TimeZoneNote } from '@/components/consultations/time-zone-note'
import { ConsultationList } from '@/components/consultations/consultation-list'
import { requireRolePage } from '@/lib/auth/guards'
import { listOwn } from '@/lib/consultations/service'

export default async function DashboardPage() {
  const { userId } = await requireRolePage('student')
  const items = await listOwn(userId)

  return (
    <div className="grid gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold">Your consultations</h1>
          <TimeZoneNote />
        </div>
        <Button asChild>
          <Link href="/consultations/new">Book a consultation</Link>
        </Button>
      </div>
      <ConsultationList items={items} />
    </div>
  )
}
