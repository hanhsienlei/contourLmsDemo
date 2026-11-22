import { BookingForm } from '@/components/consultations/booking-form'
import { requireRolePage } from '@/lib/auth/guards'

export default async function NewConsultationPage() {
  await requireRolePage('student')

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">Book a consultation</h1>
      <BookingForm />
    </div>
  )
}
