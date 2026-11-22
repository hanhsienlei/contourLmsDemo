'use client'

import { useState } from 'react'
import { apiFetch } from '@/lib/api/client'
import type { Consultation } from '@/lib/consultations/service'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { LocalTime, useSlotLabel } from './local-time'
import { useApiAction } from './use-api-action'

export function CancelDialog({ item }: { item: Consultation }) {
  const [open, setOpen] = useState(false)
  const label = useSlotLabel(item.scheduledAt)
  const { pending, run } = useApiAction()

  const confirm = () =>
    run(
      () => apiFetch(`/api/consultations/${item.id}/cancel`, { method: 'POST' }),
      'Consultation cancelled',
      () => setOpen(false),
    )

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" aria-label={label ? `Cancel consultation on ${label}` : undefined}>
          Cancel
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel this consultation?</AlertDialogTitle>
          <AlertDialogDescription>
            Your booking on <LocalTime iso={item.scheduledAt} /> will be cancelled. This can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Keep it</AlertDialogCancel>
          <Button variant="destructive" onClick={confirm} disabled={pending}>
            {pending ? 'Cancelling…' : 'Cancel consultation'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
