'use client'

import { forwardRef } from 'react'
import type { DisplayState } from '@/lib/consultations/display'
import type { Consultation } from '@/lib/consultations/types'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { ConsultationTime } from './consultation-time'
import { StatusBadge } from './status-badge'

/** A row's reason as its title: up to two lines, and a button that opens the details dialog (spec §6.6). */
export const ReasonButton = forwardRef<
  HTMLButtonElement,
  { reason: string; className?: string } & Omit<React.ComponentProps<typeof Button>, 'children'>
>(function ReasonButton({ reason, className, ...props }, ref) {
  return (
    <Button
      ref={ref}
      type="button"
      variant="link"
      className={cn(
        'h-auto justify-start whitespace-normal p-0 text-left text-base font-semibold text-foreground',
        className,
      )}
      {...props}
    >
      <span className="line-clamp-2 break-words">{reason}</span>
    </Button>
  )
})

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

/**
 * The full booking: reason (unclipped), time and status, plus the student for admins. `actions`
 * fills the footer (the student's row actions); without it the footer is a single Close button.
 */
export function ConsultationDetailsDialog({
  item,
  state,
  student,
  open,
  onOpenChange,
  onCloseAutoFocus,
  trigger,
  actions,
}: {
  item: Consultation
  state: DisplayState
  student?: { name: string; email: string }
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onCloseAutoFocus?: (event: Event) => void
  /** Rendered as the dialog's trigger, so Radix returns focus to it on close. */
  trigger?: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger}
      <DialogContent className="max-h-[90vh] overflow-y-auto" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle>Consultation details</DialogTitle>
          <DialogDescription className="sr-only">The full reason, time and status of this booking.</DialogDescription>
        </DialogHeader>
        <dl className="grid gap-4">
          <Field label="Reason">
            <p className="whitespace-pre-wrap break-words">{item.reason}</p>
          </Field>
          <Field label="When">
            <ConsultationTime iso={item.scheduledAt} />
          </Field>
          <Field label="Status">
            <StatusBadge state={state} />
          </Field>
          {student && (
            <Field label="Student">
              <span className="grid">
                <span>{student.name}</span>
                <span className="text-sm text-muted-foreground">{student.email}</span>
              </span>
            </Field>
          )}
        </dl>
        <DialogFooter>
          {actions ?? (
            <DialogClose asChild>
              <Button variant="outline">Close</Button>
            </DialogClose>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
