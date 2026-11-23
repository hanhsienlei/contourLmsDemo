'use client'

import { useMemo, useRef, useState } from 'react'
import type { DialogAction } from '@/lib/consultations/display'
import type { Consultation } from '@/lib/consultations/types'
import { CancelDialog } from './cancel-dialog'
import { ConsultationDialog } from './consultation-dialog'

export type OpenDialog = DialogAction | 'details' | null

/**
 * Which of a row's dialogs is open, and where focus goes back to when it closes. A menu item's
 * dialog opens as the menu closes: `menuCloseAutoFocus` skips the menu's focus restore so it
 * can't fight the dialog, and focus returns to the ⋯ trigger instead.
 */
export function useRowDialogs() {
  const [openDialog, setOpenDialog] = useState<OpenDialog>(null)
  const menuTrigger = useRef<HTMLButtonElement>(null)
  const dialogOpening = useRef(false)
  // The control that opened the dialog, so focus can come back to it (not <body>) when the dialog closes.
  const opener = useRef<HTMLElement | null>(null)

  return {
    openDialog,
    setOpenDialog,
    menuTrigger,
    openFromButton(action: DialogAction | 'details', button: HTMLElement) {
      opener.current = button
      setOpenDialog(action)
    },
    openFromMenu(action: DialogAction) {
      dialogOpening.current = true
      opener.current = menuTrigger.current
      setOpenDialog(action)
    },
    menuCloseAutoFocus(event: Event) {
      if (!dialogOpening.current) return
      dialogOpening.current = false
      event.preventDefault()
    },
    returnFocus(event: Event) {
      event.preventDefault()
      if (opener.current?.isConnected) opener.current.focus()
    },
  }
}

export type RowDialogs = ReturnType<typeof useRowDialogs>

/** A row's Reschedule and Cancel dialogs, opened through `useRowDialogs`. `occupied` is epoch ms from the server. */
export function RowDialogs({
  item,
  occupied,
  dialogs,
}: {
  item: Consultation
  occupied: number[]
  dialogs: RowDialogs
}) {
  const occupiedSet = useMemo(() => new Set(occupied), [occupied])
  const { openDialog, setOpenDialog, returnFocus } = dialogs
  return (
    <>
      <ConsultationDialog
        mode="reschedule"
        item={item}
        occupied={occupiedSet}
        open={openDialog === 'reschedule'}
        onCloseAutoFocus={returnFocus}
        onOpenChange={(o) => setOpenDialog(o ? 'reschedule' : null)}
      />
      <CancelDialog
        item={item}
        trigger={false}
        open={openDialog === 'cancel'}
        onCloseAutoFocus={returnFocus}
        onOpenChange={(o) => setOpenDialog(o ? 'cancel' : null)}
      />
    </>
  )
}
