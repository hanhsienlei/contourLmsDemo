'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { actionsFor, type DisplayState, type RowAction } from '@/lib/consultations/display'
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
  const occupiedSet = useMemo(() => new Set(occupied), [occupied])
  const slot = useSlotLabel(item.scheduledAt)
  const { visible, menu } = actionsFor(state)
  const [primary, ...secondary] = visible
  const dialogActions = (list: RowAction[]) => list.filter((a) => a === 'reschedule' || a === 'cancel')
  const secondaryDialog = dialogActions(secondary)
  const menuDialog = dialogActions(menu)
  // The ⋯ trigger renders only where it has items: always for `menu`, below `sm` for mirrored secondary actions.
  const showMenu = menuDialog.length > 0 || secondaryDialog.length > 0
  const menuClass = menuDialog.length > 0 ? undefined : 'sm:hidden'
  const cancelled = state === 'cancelled'

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
        {secondaryDialog.map((action) => (
          <Button
            key={action}
            variant="outline"
            size="sm"
            className="hidden sm:inline-flex"
            aria-label={slot ? `${LABEL[action]} consultation on ${slot}` : undefined}
            onClick={() => setOpenDialog(action as OpenDialog)}
          >
            {LABEL[action]}
          </Button>
        ))}
        {showMenu && (
          <RowActionsMenu slotLabel={slot} className={menuClass}>
            {secondaryDialog.map((action) => (
              <DropdownMenuItem
                key={action}
                className="sm:hidden"
                aria-label={slot ? `${LABEL[action]}, consultation on ${slot}` : undefined}
                onSelect={() => setOpenDialog(action as OpenDialog)}
              >
                {LABEL[action]}
              </DropdownMenuItem>
            ))}
            {menuDialog.map((action) => (
              <DropdownMenuItem
                key={action}
                aria-label={slot ? `${LABEL[action]}, consultation on ${slot}` : undefined}
                onSelect={() => setOpenDialog(action as OpenDialog)}
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
            onOpenChange={(o) => setOpenDialog(o ? 'reschedule' : null)}
          />
          <CancelDialog
            item={item}
            trigger={false}
            open={openDialog === 'cancel'}
            onOpenChange={(o) => setOpenDialog(o ? 'cancel' : null)}
          />
        </>
      )}
    </li>
  )
}
