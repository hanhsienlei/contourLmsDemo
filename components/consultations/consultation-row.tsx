'use client'

import { useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { rowLayout, type DialogAction, type DisplayState } from '@/lib/consultations/display'
import type { Consultation } from '@/lib/consultations/service'
import { CancelDialog } from './cancel-dialog'
import { CompleteButton } from './complete-button'
import { ConsultationDialog } from './consultation-dialog'
import { ConsultationTime } from './consultation-time'
import { useSlotLabel } from './local-time'
import { RowActionsMenu } from './row-actions-menu'
import { StatusBadge } from './status-badge'

type OpenDialog = 'reschedule' | 'cancel' | null

const LABEL: Record<'reschedule' | 'cancel', string> = { reschedule: 'Reschedule', cancel: 'Cancel' }

export function ConsultationRow({
  item,
  state,
  note,
  occupied,
}: {
  item: Consultation
  state: DisplayState
  note?: string
  /** Epoch ms of the student's active slots, from the server. */
  occupied: number[]
}) {
  const [openDialog, setOpenDialog] = useState<OpenDialog>(null)
  // A menu item's dialog opens as the menu closes: skip the menu's focus restore so it can't fight the dialog.
  const menuTrigger = useRef<HTMLButtonElement>(null)
  const dialogOpening = useRef(false)
  // The control that opened the dialog, so focus can come back to it (not <body>) when the dialog closes.
  const opener = useRef<HTMLElement | null>(null)
  const occupiedSet = useMemo(() => new Set(occupied), [occupied])
  const slot = useSlotLabel(item.scheduledAt)
  const { primary, secondary, menuOnly, menuVisibility } = rowLayout(state)
  const menuClass = menuVisibility === 'below-sm' ? 'sm:hidden' : undefined
  const cancelled = state === 'cancelled'

  const openFromButton = (action: DialogAction, button: HTMLElement) => {
    opener.current = button
    setOpenDialog(action)
  }
  const openFromMenu = (action: DialogAction) => {
    dialogOpening.current = true
    opener.current = menuTrigger.current
    setOpenDialog(action)
  }
  const returnFocus = (event: Event) => {
    event.preventDefault()
    if (opener.current?.isConnected) opener.current.focus()
  }

  return (
    <li
      className={`flex items-center justify-between gap-3 rounded-lg border p-4 ${
        cancelled ? 'bg-muted/40 text-muted-foreground' : ''
      }`}
    >
      <div className="grid min-w-0 gap-1">
        <p className="truncate font-medium" title={item.reason}>
          {item.reason}
        </p>
        <div className="flex flex-wrap items-center gap-x-2 text-sm">
          <ConsultationTime iso={item.scheduledAt} />
          {note && <span className="text-muted-foreground">{note}</span>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <StatusBadge state={state} />
        {(primary === 'complete' || primary === 'incomplete') && <CompleteButton item={item} />}
        {secondary.map((action) => (
          <Button
            key={action}
            variant="outline"
            size="sm"
            className="hidden sm:inline-flex"
            aria-label={slot ? `${LABEL[action]} consultation on ${slot}` : undefined}
            onClick={(e) => openFromButton(action, e.currentTarget)}
          >
            {LABEL[action]}
          </Button>
        ))}
        {menuVisibility !== 'never' && (
          <RowActionsMenu
            slotLabel={slot}
            className={menuClass}
            triggerRef={menuTrigger}
            onCloseAutoFocus={(e) => {
              if (!dialogOpening.current) return
              dialogOpening.current = false
              e.preventDefault()
            }}
          >
            {secondary.map((action) => (
              <DropdownMenuItem
                key={action}
                className="sm:hidden"
                aria-label={slot ? `${LABEL[action]}, consultation on ${slot}` : undefined}
                onSelect={() => openFromMenu(action)}
              >
                {LABEL[action]}
              </DropdownMenuItem>
            ))}
            {menuOnly.map((action) => (
              <DropdownMenuItem
                key={action}
                aria-label={slot ? `${LABEL[action]}, consultation on ${slot}` : undefined}
                onSelect={() => openFromMenu(action)}
              >
                {LABEL[action]}
              </DropdownMenuItem>
            ))}
          </RowActionsMenu>
        )}
      </div>
      {!cancelled && (
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
      )}
    </li>
  )
}
