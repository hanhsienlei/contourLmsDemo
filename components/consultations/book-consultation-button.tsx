'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ConsultationDialog } from './consultation-dialog'

/** "Book a consultation" button that owns the book dialog. `occupied` is epoch ms from the server. */
export function BookConsultationButton({
  openOnLoad = false,
  occupied,
  defaults,
  label = 'Book a consultation',
}: {
  openOnLoad?: boolean
  occupied: number[]
  defaults: { firstName: string; lastName: string }
  label?: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(openOnLoad)
  const occupiedSet = useMemo(() => new Set(occupied), [occupied])

  // Opened from `?book=1`: drop the param so a reload or back doesn't reopen the dialog.
  useEffect(() => {
    if (openOnLoad) router.replace('/dashboard', { scroll: false })
  }, [openOnLoad, router])

  return (
    <>
      <Button onClick={() => setOpen(true)}>{label}</Button>
      <ConsultationDialog
        mode="book"
        open={open}
        onOpenChange={setOpen}
        occupied={occupiedSet}
        defaults={defaults}
      />
    </>
  )
}
