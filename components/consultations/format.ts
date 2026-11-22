import { format } from 'date-fns'

/** Local-time label, e.g. "Mon 24 Nov, 3:15 pm". */
export function formatSlot(iso: string): string {
  return format(new Date(iso), 'EEE d MMM, h:mm aaa')
}
