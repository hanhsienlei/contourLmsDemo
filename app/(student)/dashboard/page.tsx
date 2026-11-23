import { BookConsultationButton } from '@/components/consultations/book-consultation-button'
import { TimeZoneNote } from '@/components/consultations/time-zone-note'
import { ConsultationList } from '@/components/consultations/consultation-list'
import { requireRolePage } from '@/lib/auth/guards'
import { activeSlotKeys } from '@/lib/consultations/display'
import { getProfileName, listOwn } from '@/lib/consultations/service'

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const { userId } = await requireRolePage('student')
  const [items, defaults, sp] = await Promise.all([listOwn(userId), getProfileName(userId), searchParams])
  const occupied = [...activeSlotKeys(items)]

  return (
    <div className="grid gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold">Your consultations</h1>
          <TimeZoneNote />
        </div>
        <BookConsultationButton openOnLoad={sp.book === '1'} occupied={occupied} defaults={defaults} />
      </div>
      <ConsultationList items={items} occupied={occupied} defaults={defaults} />
    </div>
  )
}
