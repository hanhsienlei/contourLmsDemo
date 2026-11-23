'use client'

import { useId, useState } from 'react'
import { Button } from '@/components/ui/button'

/** Disclosure for cancelled rows, collapsed unless `defaultOpen`. `footer` (paging) shows only while open. */
export function CancelledToggle({
  count,
  defaultOpen = false,
  footer,
  children,
}: {
  count: number
  defaultOpen?: boolean
  footer?: React.ReactNode
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const id = useId()
  return (
    <div className="grid gap-3">
      <Button
        variant="ghost"
        size="sm"
        className="justify-self-start"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? 'Hide cancelled' : `Show cancelled (${count})`}
      </Button>
      {open && (
        <div id={id} className="grid gap-3">
          <ul className="grid gap-3">{children}</ul>
          {footer}
        </div>
      )}
    </div>
  )
}
