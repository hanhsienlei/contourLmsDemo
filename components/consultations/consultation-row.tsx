import type { DisplayState } from '@/lib/consultations/display'
import type { Consultation } from '@/lib/consultations/service'
import { CancelDialog } from './cancel-dialog'
import { LocalTime } from './local-time'
import { RescheduleDialog } from './reschedule-dialog'
import { StatusBadge } from './status-badge'
import { StatusToggle } from './status-toggle'

export function ConsultationRow({ item, state }: { item: Consultation; state: DisplayState }) {
  const { status } = item
  return (
    <li
      className={`flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between ${
        status === 'cancelled' ? 'bg-muted/40 text-muted-foreground' : ''
      }`}
    >
      <div className="grid gap-1">
        <div className="flex items-center gap-2">
          <LocalTime iso={item.scheduledAt} />
          <StatusBadge state={state} />
        </div>
        <p className="text-sm">
          {item.firstName} {item.lastName}: {item.reason}
        </p>
      </div>
      {status !== 'cancelled' && (
        <div className="flex items-center gap-3">
          <StatusToggle item={item} />
          {status === 'scheduled' && (
            <>
              <RescheduleDialog item={item} />
              <CancelDialog item={item} />
            </>
          )}
        </div>
      )}
    </li>
  )
}
