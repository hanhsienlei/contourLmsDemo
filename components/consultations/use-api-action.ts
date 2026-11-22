'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

/**
 * Runs one API request at a time: toast on success/failure, refresh server data on success.
 * Callers react to success (close a dialog, navigate) through `onSuccess`.
 */
export function useApiAction() {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const inFlight = useRef(false)

  async function run(
    request: () => Promise<unknown>,
    successMessage: string,
    onSuccess?: () => void,
  ): Promise<void> {
    if (inFlight.current) return
    inFlight.current = true
    setPending(true)
    try {
      await request()
      toast.success(successMessage)
      onSuccess?.()
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      inFlight.current = false
      setPending(false)
    }
  }

  return { pending, run }
}
