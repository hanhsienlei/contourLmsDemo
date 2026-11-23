import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { displayState, type DisplayState } from '@/lib/consultations/display'
import type { Consultation } from '@/lib/consultations/types'

/** One table column: its header and how one row's cell renders. */
export type Column<T extends Consultation> = {
  id: string
  header: string
  /** Screen-reader-only header (e.g. the actions column, whose buttons name themselves). */
  srOnlyHeader?: boolean
  className?: string
  cell: (item: T, state: DisplayState) => React.ReactNode
}

const ROW_CLASS: Partial<Record<DisplayState, string>> = {
  needs_update: 'bg-amber-50/60 dark:bg-amber-950/40',
  cancelled: 'text-muted-foreground',
}

/**
 * The consultation table shared by the dashboard and the admin list (spec §6.7). It knows nothing
 * about roles: each page passes the columns it shows.
 */
export function ConsultationTable<T extends Consultation>({
  items,
  now,
  columns,
  caption,
}: {
  items: T[]
  now: Date
  columns: readonly Column<T>[]
  caption: string
}) {
  return (
    <Table>
      <caption className="sr-only">{caption}</caption>
      <TableHeader>
        <TableRow>
          {columns.map((col) => (
            <TableHead key={col.id} scope="col" className={col.className}>
              {col.srOnlyHeader ? <span className="sr-only">{col.header}</span> : col.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.length === 0 && (
          <TableRow>
            <TableCell colSpan={columns.length} className="text-center text-muted-foreground">
              No consultations in this list.
            </TableCell>
          </TableRow>
        )}
        {items.map((item) => {
          const state = displayState(item, now)
          return (
            <TableRow key={item.id} className={ROW_CLASS[state]}>
              {columns.map((col) => (
                <TableCell key={col.id} className={col.className}>
                  {col.cell(item, state)}
                </TableCell>
              ))}
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
