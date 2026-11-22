import { Badge } from '@/components/ui/badge'
import { DISPLAY_STATE_LABEL, type DisplayState } from '@/lib/consultations/display'

const STYLE: Record<DisplayState, { variant: 'secondary' | 'outline'; className?: string }> = {
  upcoming: { variant: 'secondary' },
  needs_update: {
    variant: 'outline',
    className:
      'border-amber-600/50 bg-amber-50 text-amber-900 dark:border-amber-400/50 dark:bg-amber-950 dark:text-amber-200',
  },
  completed: {
    variant: 'outline',
    className: 'border-transparent bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200',
  },
  cancelled: { variant: 'outline', className: 'text-muted-foreground' },
}

/** Always renders the state as text, never by colour alone. */
export function StatusBadge({ state }: { state: DisplayState }) {
  const { variant, className } = STYLE[state]
  return (
    <Badge variant={variant} className={className}>
      {DISPLAY_STATE_LABEL[state]}
    </Badge>
  )
}
