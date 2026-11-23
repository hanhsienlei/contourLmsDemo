'use client'

import { apiFetch } from '@/lib/api/client'
import { ROW_ACTION_LABEL, actionAriaLabel, type ActionVariant } from '@/lib/consultations/display'
import type { Consultation } from '@/lib/consultations/types'
import { Button } from '@/components/ui/button'
import { useSlotLabel } from './local-time'
import { useApiAction } from './use-api-action'

/**
 * The row's complete/incomplete toggle; `action` comes from `rowLayout`, so the row decides which way it
 * toggles, and `variant` from `actionVariant`. `onDone` runs after a successful change.
 */
export function CompleteButton({
  item,
  action,
  variant = 'outline',
  onDone,
}: {
  item: Consultation
  action: 'complete' | 'incomplete'
  variant?: ActionVariant
  onDone?: () => void
}) {
  const { pending, run } = useApiAction()
  const slot = useSlotLabel(item.scheduledAt)
  const completing = action === 'complete'

  return (
    <Button
      variant={variant}
      size="sm"
      disabled={pending}
      aria-label={actionAriaLabel(action, slot)}
      onClick={() =>
        run(
          () => apiFetch(`/api/consultations/${item.id}`, { method: 'PATCH', body: { completed: completing } }),
          completing ? 'Marked complete' : 'Marked incomplete',
          onDone,
        )
      }
    >
      {ROW_ACTION_LABEL[action]}
    </Button>
  )
}
