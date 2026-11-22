'use client'

import { useState } from 'react'
import { apiFetch } from '@/lib/api/client'
import type { Consultation } from '@/lib/consultations/service'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { LocalTime, useSlotLabel } from './local-time'
import { SlotPicker } from './slot-picker'
import { useApiAction } from './use-api-action'

export function RescheduleDialog({
  item,
  open: openProp,
  onOpenChange,
  trigger = true,
}: {
  item: Consultation
  open?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: boolean
}) {
  const [openState, setOpenState] = useState(false)
  const open = openProp ?? openState
  const setOpen = (next: boolean) => {
    setOpenState(next)
    onOpenChange?.(next)
  }
  const [slot, setSlot] = useState('')
  const label = useSlotLabel(item.scheduledAt)
  const { pending, run } = useApiAction()

  const submit = () =>
    run(
      () => apiFetch(`/api/consultations/${item.id}`, { method: 'PATCH', body: { scheduledAt: slot } }),
      'Consultation rescheduled',
      () => setOpen(false),
    )

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setSlot('')
      }}
    >
      {trigger && (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" aria-label={label ? `Reschedule consultation on ${label}` : undefined}>
            Reschedule
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reschedule consultation</DialogTitle>
          <DialogDescription>
            Currently <LocalTime iso={item.scheduledAt} />. Pick a new slot.
          </DialogDescription>
        </DialogHeader>
        <SlotPicker value={slot} onChange={setSlot} />
        <DialogFooter>
          <Button onClick={submit} disabled={!slot || pending}>
            {pending ? 'Rescheduling…' : 'Reschedule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
