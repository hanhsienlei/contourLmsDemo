'use client'

import { apiFetch } from '@/lib/api/client'
import type { Consultation } from '@/lib/consultations/service'
import { Button } from '@/components/ui/button'
import { useSlotLabel } from './local-time'
import { useApiAction } from './use-api-action'

export function CompleteButton({ item }: { item: Consultation }) {
  const { pending, run } = useApiAction()
  const slot = useSlotLabel(item.scheduledAt)
  const completed = item.status === 'completed'
  const text = completed ? 'Mark incomplete' : 'Mark complete'
  const ariaLabel = slot ? `${text}, consultation on ${slot}` : text

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      aria-label={ariaLabel}
      onClick={() =>
        run(
          () => apiFetch(`/api/consultations/${item.id}`, { method: 'PATCH', body: { completed: !completed } }),
          completed ? 'Marked incomplete' : 'Marked complete',
        )
      }
    >
      {text}
    </Button>
  )
}
