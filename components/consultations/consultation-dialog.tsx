'use client'

import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { apiFetch } from '@/lib/api/client'
import { createConsultationSchema, type CreateConsultationInput } from '@/lib/consultations/schema'
import type { Consultation, StudentName } from '@/lib/consultations/types'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatSlot } from './format'
import { SlotPicker } from './slot-picker'
import { useApiAction } from './use-api-action'

const REASON_MAX = createConsultationSchema.shape.reason.maxLength ?? undefined

type Common = {
  open: boolean
  onOpenChange(open: boolean): void
  occupied: Set<number>
  /** Where focus goes when the dialog closes; call `preventDefault()` to take over. */
  onCloseAutoFocus?: (event: Event) => void
}

type Action = ReturnType<typeof useApiAction>

type Props = (Common & { mode: 'book'; defaults: StudentName }) | (Common & { mode: 'reschedule'; item: Consultation })

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} role="alert" className="text-sm text-destructive">
      {message}
    </p>
  )
}

/** Props that tie an input to its error text (and any helper text) for assistive tech. */
const errorProps = (id: string, message?: string, helpId?: string) => ({
  'aria-invalid': message ? true : undefined,
  'aria-describedby': [helpId, message ? `${id}-error` : undefined].filter(Boolean).join(' ') || undefined,
})

function Field({
  label,
  id,
  error,
  children,
}: {
  label: string
  id: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      <FieldError id={`${id}-error`} message={error} />
    </div>
  )
}

function CancelButton({ disabled }: { disabled: boolean }) {
  return (
    <DialogClose asChild>
      <Button type="button" variant="outline" disabled={disabled}>
        Cancel
      </Button>
    </DialogClose>
  )
}

function BookForm({
  occupied,
  defaults,
  action: { pending, run },
  onDone,
}: {
  occupied: Set<number>
  defaults: StudentName
  action: Action
  onDone(): void
}) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateConsultationInput>({
    resolver: zodResolver(createConsultationSchema),
    defaultValues: { ...defaults, reason: '', scheduledAt: '' },
  })
  const [reason, slot] = useWatch({ control, name: ['reason', 'scheduledAt'] })

  const onSubmit = (body: CreateConsultationInput) =>
    run(() => apiFetch('/api/consultations', { method: 'POST', body }), 'Consultation booked', onDone)

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="First name" id="firstName" error={errors.firstName?.message}>
          <Input
            id="firstName"
            autoComplete="given-name"
            {...errorProps('firstName', errors.firstName?.message)}
            {...register('firstName')}
          />
        </Field>
        <Field label="Last name" id="lastName" error={errors.lastName?.message}>
          <Input
            id="lastName"
            autoComplete="family-name"
            {...errorProps('lastName', errors.lastName?.message)}
            {...register('lastName')}
          />
        </Field>
      </div>
      <Field label="Reason" id="reason" error={errors.reason?.message}>
        <Textarea
          id="reason"
          rows={3}
          placeholder="Go over my Methods SAC practice questions"
          {...errorProps('reason', errors.reason?.message, 'reason-help')}
          {...register('reason')}
        />
        <div className="flex justify-between gap-2 text-sm text-muted-foreground">
          <p id="reason-help">What would you like help with?</p>
          <p className={reason.length > (REASON_MAX ?? Infinity) ? 'tabular-nums text-destructive' : 'tabular-nums'}>
            {reason.length}/{REASON_MAX}
          </p>
        </div>
      </Field>
      <fieldset className="grid gap-2" aria-describedby={errors.scheduledAt ? 'scheduledAt-error' : undefined}>
        <legend className="mb-2 text-sm font-medium">When</legend>
        <Controller
          control={control}
          name="scheduledAt"
          render={({ field }) => <SlotPicker value={field.value} onChange={field.onChange} occupied={occupied} />}
        />
        <FieldError id="scheduledAt-error" message={errors.scheduledAt?.message} />
      </fieldset>
      <DialogFooter>
        <CancelButton disabled={pending} />
        <Button type="submit" disabled={pending}>
          {pending ? 'Booking…' : slot ? `Book for ${formatSlot(slot)}` : 'Book consultation'}
        </Button>
      </DialogFooter>
    </form>
  )
}

function RescheduleForm({
  item,
  occupied,
  action: { pending, run },
  onDone,
}: {
  item: Consultation
  occupied: Set<number>
  action: Action
  onDone(): void
}) {
  const [slot, setSlot] = useState('')

  const submit = () =>
    run(
      () => apiFetch(`/api/consultations/${item.id}`, { method: 'PATCH', body: { scheduledAt: slot } }),
      `Moved to ${formatSlot(slot)}`,
      onDone,
      { conflictHint: 'Refresh the page to see the latest bookings.' },
    )

  return (
    <div className="grid gap-5">
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">When</legend>
        <SlotPicker value={slot} onChange={setSlot} occupied={occupied} currentIso={item.scheduledAt} />
      </fieldset>
      <DialogFooter>
        <CancelButton disabled={pending} />
        <Button onClick={submit} disabled={!slot || pending}>
          {pending ? 'Rescheduling…' : slot ? `Move to ${formatSlot(slot)}` : 'Reschedule'}
        </Button>
      </DialogFooter>
    </div>
  )
}

/**
 * Book a new consultation or move an existing one. The content mounts only while open, so closing
 * resets the form and times always render client-side.
 */
export function ConsultationDialog(props: Props) {
  const { open, onOpenChange, occupied, onCloseAutoFocus } = props
  const close = () => onOpenChange(false)
  // The request state lives here, above the form, so it survives the content unmounting. While a request
  // is in flight the dialog can't be dismissed, so the double-submit guard can't be bypassed.
  const action = useApiAction()
  const blockWhilePending = (event: Event) => {
    if (action.pending) event.preventDefault()
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next || !action.pending) && onOpenChange(next)}>
      <DialogContent
        onEscapeKeyDown={blockWhilePending}
        onPointerDownOutside={blockWhilePending}
        onInteractOutside={blockWhilePending}
        onCloseAutoFocus={onCloseAutoFocus}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl"
        {...(props.mode === 'book' ? { 'aria-describedby': undefined } : {})}
      >
        {props.mode === 'book' ? (
          <>
            <DialogHeader>
              <DialogTitle>Book a consultation</DialogTitle>
            </DialogHeader>
            <BookForm occupied={occupied} defaults={props.defaults} action={action} onDone={close} />
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Reschedule consultation</DialogTitle>
              <DialogDescription>
                <span className="line-clamp-2 break-words font-medium text-foreground">{props.item.reason}</span>
                <span className="block">Currently {formatSlot(props.item.scheduledAt)}</span>
              </DialogDescription>
            </DialogHeader>
            <RescheduleForm item={props.item} occupied={occupied} action={action} onDone={close} />
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
