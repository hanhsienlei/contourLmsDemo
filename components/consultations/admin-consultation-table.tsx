import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { displayState } from '@/lib/consultations/display'
import type { AdminConsultation } from '@/lib/consultations/service'
import { LocalTime } from './local-time'
import { StatusBadge } from './status-badge'

/** Read-only admin listing; cancelled rows are included and muted. */
export function AdminConsultationTable({ items, now }: { items: AdminConsultation[]; now: Date }) {
  return (
    <Table>
      <caption className="sr-only">All consultations</caption>
      <TableHeader>
        <TableRow>
          <TableHead scope="col">Email</TableHead>
          <TableHead scope="col">Name</TableHead>
          <TableHead scope="col">Reason</TableHead>
          <TableHead scope="col">Time</TableHead>
          <TableHead scope="col">Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.length === 0 && (
          <TableRow>
            <TableCell colSpan={5} className="text-center text-muted-foreground">
              No consultations yet.
            </TableCell>
          </TableRow>
        )}
        {items.map((item) => (
          <TableRow key={item.id} className={item.status === 'cancelled' ? 'text-muted-foreground' : undefined}>
            <TableCell>{item.email}</TableCell>
            <TableCell>
              {item.firstName} {item.lastName}
            </TableCell>
            <TableCell className="max-w-64 truncate" title={item.reason}>
              {item.reason}
            </TableCell>
            <TableCell>
              <LocalTime iso={item.scheduledAt} />
            </TableCell>
            <TableCell>
              <StatusBadge state={displayState(item, now)} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
