'use client'

import type { DisplayState } from '@/lib/consultations/display'
import type { AdminConsultation } from '@/lib/consultations/types'
import { DialogTrigger } from '@/components/ui/dialog'
import { ConsultationDetailsDialog, ReasonButton } from './consultation-details'

/** The admin table's reason cell: two lines, opening the read-only details dialog. */
export function AdminReason({ item, state }: { item: AdminConsultation; state: DisplayState }) {
  return (
    <ConsultationDetailsDialog
      item={item}
      state={state}
      student={{ name: `${item.firstName} ${item.lastName}`, email: item.email }}
      trigger={
        <DialogTrigger asChild>
          <ReasonButton reason={item.reason} className="text-sm font-normal" />
        </DialogTrigger>
      }
    />
  )
}
