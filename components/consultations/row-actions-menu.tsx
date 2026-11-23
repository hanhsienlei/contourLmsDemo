'use client'

import { MoreHorizontal } from 'lucide-react'
import { moreActionsAriaLabel } from '@/lib/consultations/display'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

/** Overflow menu for a row's secondary actions; children are DropdownMenuItems. */
export function RowActionsMenu({
  slotLabel,
  children,
  className,
  triggerRef,
  onCloseAutoFocus,
}: {
  slotLabel: string
  children: React.ReactNode
  className?: string
  triggerRef?: React.Ref<HTMLButtonElement>
  /** Call `preventDefault()` to keep focus from returning to the ⋯ trigger (e.g. a dialog is opening). */
  onCloseAutoFocus?: (event: Event) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          ref={triggerRef}
          variant="ghost"
          size="icon"
          className={className}
          aria-label={moreActionsAriaLabel(slotLabel)}
        >
          <MoreHorizontal aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onCloseAutoFocus={onCloseAutoFocus}>
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
