'use client'

import { apiFetch } from '@/lib/api/client'
import { ROW_ACTION_LABEL, actionAriaLabel } from '@/lib/consultations/display'
import type { Consultation } from '@/lib/consultations/types'
import { Button } from '@/components/ui/button'
import { useSlotLabel } from './local-time'
import { useApiAction } from './use-api-action'

/** The row's primary action; `action` comes from `rowLayout`, so the row decides which way it toggles. */
export function CompleteButton({ item, action }: { item: Consultation; action: 'complete' | 'incomplete' }) {
  const { pending, run } = useApiAction()
  const slot = useSlotLabel(item.scheduledAt)
  const completing = action === 'complete'

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      aria-label={actionAriaLabel(action, slot)}
      onClick={() =>
        run(
          () => apiFetch(`/api/consultations/${item.id}`, { method: 'PATCH', body: { completed: completing } }),
          completing ? 'Marked complete' : 'Marked incomplete',
        )
      }
    >
      {ROW_ACTION_LABEL[action]}
    </Button>
  )
}
