import { timeNote } from '@/lib/consultations/display'
import type { AdminConsultation, Consultation } from '@/lib/consultations/types'
import { AdminReason } from './admin-reason'
import type { Column } from './consultation-table'
import { ConsultationTime } from './consultation-time'
import { RowActions } from './row-actions'
import { StatusBadge } from './status-badge'
import { StudentReason } from './student-reason'

// The columns the dashboard and the admin list are built from (spec §6.7). A page shows or hides
// something by listing its column or not; no column checks a role.

export const timeColumn: Column<Consultation> = {
  id: 'time',
  header: 'Time',
  cell: (item, state) => <ConsultationTime iso={item.scheduledAt} note={timeNote(state)} />,
}

export const studentColumn: Column<AdminConsultation> = {
  id: 'student',
  header: 'Student',
  cell: (item) => (
    <div className="grid">
      <span className="font-medium">
        {item.firstName} {item.lastName}
      </span>
      <span className="text-sm text-muted-foreground">{item.email}</span>
    </div>
  ),
}

/** Read-only details dialog, with the student's name and email. */
export const adminReasonColumn: Column<AdminConsultation> = {
  id: 'reason',
  header: 'Reason',
  className: 'max-w-64 whitespace-normal',
  cell: (item, state) => <AdminReason item={item} state={state} />,
}

/** Details dialog with the row's actions. `occupied`: epoch ms of the student's active slots. */
export const studentReasonColumn = (occupied: number[]): Column<Consultation> => ({
  id: 'reason',
  header: 'Reason',
  className: 'max-w-64 whitespace-normal',
  cell: (item, state) => <StudentReason item={item} state={state} occupied={occupied} />,
})

export const statusColumn: Column<Consultation> = {
  id: 'status',
  header: 'Status',
  cell: (_item, state) => <StatusBadge state={state} />,
}

/** The row actions (spec §4). `occupied`: epoch ms of the student's active slots. */
export const actionsColumn = (occupied: number[]): Column<Consultation> => ({
  id: 'actions',
  header: 'Actions',
  srOnlyHeader: true,
  className: 'text-right',
  cell: (item, state) => <RowActions item={item} state={state} occupied={occupied} />,
})
