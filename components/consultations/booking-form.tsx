'use client'

import { useRouter } from 'next/navigation'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { apiFetch } from '@/lib/api/client'
import { createConsultationSchema, type CreateConsultationInput } from '@/lib/consultations/schema'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SlotPicker } from './slot-picker'
import { useApiAction } from './use-api-action'

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} role="alert" className="text-sm text-destructive">
      {message}
    </p>
  )
}

/** Props that tie an input to its error text for assistive tech. */
const errorProps = (id: string, message?: string) => ({
  'aria-invalid': message ? true : undefined,
  'aria-describedby': message ? `${id}-error` : undefined,
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

export function BookingForm() {
  const router = useRouter()
  const { pending, run } = useApiAction()
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateConsultationInput>({
    resolver: zodResolver(createConsultationSchema),
    defaultValues: { firstName: '', lastName: '', reason: '', scheduledAt: '' },
  })

  const onSubmit = (body: CreateConsultationInput) =>
    run(
      () => apiFetch('/api/consultations', { method: 'POST', body }),
      'Consultation booked',
      () => router.push('/dashboard'),
    )

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid max-w-xl gap-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="First name" id="firstName" error={errors.firstName?.message}>
          <Input id="firstName" autoComplete="given-name" {...errorProps('firstName', errors.firstName?.message)} {...register('firstName')} />
        </Field>
        <Field label="Last name" id="lastName" error={errors.lastName?.message}>
          <Input id="lastName" autoComplete="family-name" {...errorProps('lastName', errors.lastName?.message)} {...register('lastName')} />
        </Field>
      </div>
      <Field label="Reason" id="reason" error={errors.reason?.message}>
        <Textarea id="reason" rows={4} {...errorProps('reason', errors.reason?.message)} {...register('reason')} />
      </Field>
      <fieldset
        className="grid gap-2"
        aria-describedby={errors.scheduledAt ? 'scheduledAt-error' : undefined}
      >
        <legend className="mb-2 text-sm font-medium">When</legend>
        <Controller
          control={control}
          name="scheduledAt"
          render={({ field }) => <SlotPicker value={field.value} onChange={field.onChange} />}
        />
        <FieldError id="scheduledAt-error" message={errors.scheduledAt && 'Choose a day and time'} />
      </fieldset>
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? 'Booking…' : 'Book consultation'}
      </Button>
    </form>
  )
}
