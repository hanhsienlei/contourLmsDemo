'use client'

import { useState } from 'react'
import { apiFetch } from '@/lib/api/client'
import { ROW_ACTION_LABEL, actionAriaLabel } from '@/lib/consultations/display'
import type { Consultation } from '@/lib/consultations/types'
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

export function CancelDialog({
  item,
  open: openProp,
  onOpenChange,
  trigger = true,
  onCloseAutoFocus,
}: {
  item: Consultation
  open?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: boolean
  /** Where focus goes when the dialog closes; call `preventDefault()` to take over. */
  onCloseAutoFocus?: (event: Event) => void
}) {
  const [openState, setOpenState] = useState(false)
  const open = openProp ?? openState
  const setOpen = (next: boolean) => {
    setOpenState(next)
    onOpenChange?.(next)
  }
  const label = useSlotLabel(item.scheduledAt)
  const { pending, run } = useApiAction()
  // While a request is in flight the dialog can't be dismissed, so the double-submit guard can't be bypassed.
  const blockWhilePending = (event: Event) => {
    if (pending) event.preventDefault()
  }

  const confirm = () =>
    run(
      () => apiFetch(`/api/consultations/${item.id}/cancel`, { method: 'POST' }),
      'Consultation cancelled',
      () => setOpen(false),
    )

  return (
    <AlertDialog open={open} onOpenChange={(next) => (next || !pending) && setOpen(next)}>
      {trigger && (
        <AlertDialogTrigger asChild>
          <Button variant="outline" size="sm" aria-label={actionAriaLabel('cancel', label)}>
            {ROW_ACTION_LABEL.cancel}
          </Button>
        </AlertDialogTrigger>
      )}
      <AlertDialogContent onEscapeKeyDown={blockWhilePending} onCloseAutoFocus={onCloseAutoFocus}>
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
