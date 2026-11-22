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

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string
  htmlFor: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
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
        <Field label="First name" htmlFor="firstName" error={errors.firstName?.message}>
          <Input id="firstName" autoComplete="given-name" {...register('firstName')} />
        </Field>
        <Field label="Last name" htmlFor="lastName" error={errors.lastName?.message}>
          <Input id="lastName" autoComplete="family-name" {...register('lastName')} />
        </Field>
      </div>
      <Field label="Reason" htmlFor="reason" error={errors.reason?.message}>
        <Textarea id="reason" rows={4} {...register('reason')} />
      </Field>
      <div className="grid gap-2">
        <Controller
          control={control}
          name="scheduledAt"
          render={({ field }) => <SlotPicker value={field.value} onChange={field.onChange} />}
        />
        {errors.scheduledAt && (
          <p role="alert" className="text-sm text-destructive">
            Choose a day and time
          </p>
        )}
      </div>
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? 'Booking…' : 'Book consultation'}
      </Button>
    </form>
  )
}
