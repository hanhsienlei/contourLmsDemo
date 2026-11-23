'use client'

import { Button } from '@/components/ui/button'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import {
  ROW_ACTION_LABEL,
  actionAriaLabel,
  actionVariant,
  rowLayout,
  type DisplayState,
} from '@/lib/consultations/display'
import type { Consultation } from '@/lib/consultations/types'
import { CompleteButton } from './complete-button'
import { useSlotLabel } from './local-time'
import { RowActionsMenu } from './row-actions-menu'
import { RowDialogs, useRowDialogs } from './row-dialogs'

/**
 * A row's action buttons and ⋯ menu (spec §4), as laid out by `rowLayout`. Renders nothing for
 * states without actions. `occupied` is epoch ms of the student's active slots, from the server.
 */
export function RowActions({ item, state, occupied }: { item: Consultation; state: DisplayState; occupied: number[] }) {
  const dialogs = useRowDialogs()
  const slot = useSlotLabel(item.scheduledAt)
  const { primary, secondary, menuOnly, menuVisibility } = rowLayout(state)
  if (!primary && secondary.length === 0 && menuOnly.length === 0) return null

  return (
    <div className="flex items-center justify-end gap-2">
      {(primary === 'complete' || primary === 'incomplete') && (
        <CompleteButton item={item} action={primary} variant={actionVariant(state, primary)} />
      )}
      {secondary.map((action) => (
        <Button
          key={action}
          variant={actionVariant(state, action)}
          size="sm"
          className="hidden sm:inline-flex"
          aria-label={actionAriaLabel(action, slot)}
          onClick={(e) => dialogs.openFromButton(action, e.currentTarget)}
        >
          {ROW_ACTION_LABEL[action]}
        </Button>
      ))}
      {menuVisibility !== 'never' && (
        <RowActionsMenu
          slotLabel={slot}
          className={menuVisibility === 'below-sm' ? 'sm:hidden' : undefined}
          triggerRef={dialogs.menuTrigger}
          onCloseAutoFocus={dialogs.menuCloseAutoFocus}
        >
          {secondary.map((action) => (
            <DropdownMenuItem
              key={action}
              className="sm:hidden"
              aria-label={actionAriaLabel(action, slot)}
              onSelect={() => dialogs.openFromMenu(action)}
            >
              {ROW_ACTION_LABEL[action]}
            </DropdownMenuItem>
          ))}
          {menuOnly.map((action) => (
            <DropdownMenuItem
              key={action}
              aria-label={actionAriaLabel(action, slot)}
              onSelect={() => dialogs.openFromMenu(action)}
            >
              {ROW_ACTION_LABEL[action]}
            </DropdownMenuItem>
          ))}
        </RowActionsMenu>
      )}
      <RowDialogs item={item} occupied={occupied} dialogs={dialogs} />
    </div>
  )
}
