'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import type { StudentName } from '@/lib/consultations/types'
import { ConsultationDialog } from './consultation-dialog'

/** "Book a consultation" button that owns the book dialog. `occupied` is epoch ms from the server. */
export function BookConsultationButton({
  openOnLoad = false,
  occupied,
  defaults,
}: {
  openOnLoad?: boolean
  occupied: number[]
  defaults: StudentName
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
      <Button onClick={() => setOpen(true)}>Book a consultation</Button>
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
