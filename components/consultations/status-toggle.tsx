'use client'

import { useId } from 'react'
import { apiFetch } from '@/lib/api/client'
import type { Consultation } from '@/lib/consultations/service'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { useApiAction } from './use-api-action'

export function StatusToggle({ item }: { item: Consultation }) {
  const id = useId()
  const { pending, run } = useApiAction()
  const completed = item.status === 'completed'

  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id={id}
        checked={completed}
        disabled={pending}
        onCheckedChange={(next) =>
          run(
            () => apiFetch(`/api/consultations/${item.id}`, { method: 'PATCH', body: { completed: next === true } }),
            next === true ? 'Marked as completed' : 'Marked as scheduled',
          )
        }
      />
      <Label htmlFor={id} className="text-sm font-normal">
        Completed
      </Label>
    </div>
  )
}
