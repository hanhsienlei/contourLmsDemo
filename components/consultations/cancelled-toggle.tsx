'use client'

import { useId, useState } from 'react'
import { Button } from '@/components/ui/button'

/** Collapsed-by-default disclosure for cancelled rows. */
export function CancelledToggle({ count, children }: { count: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <div className="grid gap-3">
      <Button
        variant="ghost"
        size="sm"
        className="justify-self-start"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? 'Hide cancelled' : `Show cancelled (${count})`}
      </Button>
      {open && (
        <ul id={id} className="grid gap-3">
          {children}
        </ul>
      )}
    </div>
  )
}
