'use client'

import { Button } from '@/components/ui/button'
import { actionVariant, detailsActionLabel, detailsActions, type DisplayState } from '@/lib/consultations/display'
import type { Consultation } from '@/lib/consultations/types'
import { CompleteButton } from './complete-button'
import { ConsultationDetailsDialog, ReasonButton } from './consultation-details'
import { RowDialogs, useRowDialogs } from './row-dialogs'

/**
 * The student's reason cell: two lines, opening the details dialog with the row's actions in its
 * footer (spec §6.6). Reschedule and Cancel close the details and open their own dialog.
 */
export function StudentReason({
  item,
  state,
  occupied,
}: {
  item: Consultation
  state: DisplayState
  occupied: number[]
}) {
  const dialogs = useRowDialogs()
  const { openDialog, setOpenDialog } = dialogs
  const actions = detailsActions(state)

  return (
    <>
      <ReasonButton
        reason={item.reason}
        className="text-sm font-normal"
        onClick={(e) => dialogs.openFromButton('details', e.currentTarget)}
      />
      <ConsultationDetailsDialog
        item={item}
        state={state}
        open={openDialog === 'details'}
        onOpenChange={(o) => setOpenDialog(o ? 'details' : null)}
        // Switching to Reschedule or Cancel: their dialog takes focus, so don't pull it back to the reason.
        onCloseAutoFocus={(e) => (openDialog === null ? dialogs.returnFocus(e) : e.preventDefault())}
        actions={
          actions.length === 0
            ? undefined
            : actions.map((action) =>
                action === 'complete' || action === 'incomplete' ? (
                  <CompleteButton
                    key={action}
                    item={item}
                    action={action}
                    variant={actionVariant(state, action)}
                    onDone={() => setOpenDialog(null)}
                  />
                ) : (
                  <Button
                    key={action}
                    variant={actionVariant(state, action)}
                    size="sm"
                    onClick={() => setOpenDialog(action)}
                  >
                    {detailsActionLabel(action)}
                  </Button>
                ),
              )
        }
      />
      {actions.length > 0 && <RowDialogs item={item} occupied={occupied} dialogs={dialogs} />}
    </>
  )
}
