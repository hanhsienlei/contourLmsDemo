import { redirect } from 'next/navigation'
import { requireRolePage } from '@/lib/auth/guards'

/** Booking lives in a dialog on the dashboard now; keep old links working. */
export default async function NewConsultationPage() {
  await requireRolePage('student')
  redirect('/dashboard?book=1')
}
