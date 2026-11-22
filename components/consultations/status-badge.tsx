import { Badge } from '@/components/ui/badge'
import type { ConsultationStatus } from '@/lib/consultations/rules'

const BADGES: Record<ConsultationStatus, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  scheduled: { label: 'Scheduled', variant: 'default' },
  completed: { label: 'Completed', variant: 'secondary' },
  cancelled: { label: 'Cancelled', variant: 'outline' },
}

/** Always renders the status as text, never by colour alone. */
export function StatusBadge({ status }: { status: ConsultationStatus }) {
  const { label, variant } = BADGES[status]
  return (
    <Badge variant={variant} className={status === 'cancelled' ? 'text-muted-foreground' : undefined}>
      {label}
    </Badge>
  )
}
