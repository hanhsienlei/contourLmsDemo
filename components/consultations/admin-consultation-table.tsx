import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { displayState, type DisplayState } from '@/lib/consultations/display'
import type { AdminConsultation } from '@/lib/consultations/types'
import { AdminReason } from './admin-reason'
import { ConsultationTime } from './consultation-time'
import { StatusBadge } from './status-badge'

const ROW_CLASS: Partial<Record<DisplayState, string>> = {
  needs_update: 'bg-amber-50/60 dark:bg-amber-950/40',
  cancelled: 'text-muted-foreground',
}

/** Read-only admin listing; cancelled rows are included and muted. */
export function AdminConsultationTable({ items, now }: { items: AdminConsultation[]; now: Date }) {
  return (
    <Table>
      <caption className="sr-only">All consultations</caption>
      <TableHeader>
        <TableRow>
          <TableHead scope="col">Time</TableHead>
          <TableHead scope="col">Student</TableHead>
          <TableHead scope="col">Reason</TableHead>
          <TableHead scope="col">Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.length === 0 && (
          <TableRow>
            <TableCell colSpan={4} className="text-center text-muted-foreground">
              No consultations yet.
            </TableCell>
          </TableRow>
        )}
        {items.map((item) => {
          const state = displayState(item, now)
          return (
            <TableRow key={item.id} className={ROW_CLASS[state]}>
              <TableCell>
                <ConsultationTime iso={item.scheduledAt} />
              </TableCell>
              <TableCell>
                <div className="grid">
                  <span className="font-medium">
                    {item.firstName} {item.lastName}
                  </span>
                  <span className="text-sm text-muted-foreground">{item.email}</span>
                </div>
              </TableCell>
              <TableCell className="max-w-64 whitespace-normal">
                <AdminReason item={item} state={state} />
              </TableCell>
              <TableCell>
                <StatusBadge state={state} />
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
