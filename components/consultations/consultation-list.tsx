import Link from 'next/link'
import type { Consultation } from '@/lib/consultations/service'
import { ConsultationRow } from './consultation-row'

function Section({
  title,
  items,
  empty,
}: {
  title: string
  items: Consultation[]
  empty?: React.ReactNode
}) {
  if (items.length === 0 && !empty) return null
  return (
    <section className="grid gap-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {items.length === 0 && <p className="text-sm text-muted-foreground">{empty}</p>}
      <ul className="grid gap-3">
        {items.map((item) => (
          <ConsultationRow key={item.id} item={item} />
        ))}
      </ul>
    </section>
  )
}

export function ConsultationList({ items }: { items: Consultation[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
        No consultations yet.{' '}
        <Link href="/consultations/new" className="font-medium text-foreground underline underline-offset-4">
          Book your first one
        </Link>
        .
      </p>
    )
  }

  // Server component: rendered once per request, so the current time is stable.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now()
  const byTime = (a: Consultation, b: Consultation) => a.scheduledAt.localeCompare(b.scheduledAt)
  const upcoming = items.filter((i) => Date.parse(i.scheduledAt) >= now).sort(byTime)
  const past = items.filter((i) => Date.parse(i.scheduledAt) < now).sort((a, b) => byTime(b, a))

  return (
    <div className="grid gap-8">
      <Section
        title="Upcoming"
        items={upcoming}
        empty={
          <>
            Nothing upcoming.{' '}
            <Link href="/consultations/new" className="font-medium text-foreground underline underline-offset-4">
              Book a consultation
            </Link>
          </>
        }
      />
      <Section title="Past" items={past} />
    </div>
  )
}
