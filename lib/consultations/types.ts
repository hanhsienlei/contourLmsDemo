import type { ConsultationStatus } from './rules'

// Shapes the service returns and the UI renders. Kept apart from service.ts,
// which imports 'server-only', so client components never depend on it.

export type Consultation = {
  id: string
  firstName: string
  lastName: string
  reason: string
  scheduledAt: string
  status: ConsultationStatus
  createdAt: string
  updatedAt: string
}

export type AdminConsultation = Consultation & { email: string }

export type StudentName = { firstName: string; lastName: string }

/** One page of a keyset-paginated list. `total` counts the whole list, not the page. */
export type Page<T> = { items: T[]; nextCursor: string | null; total: number }
