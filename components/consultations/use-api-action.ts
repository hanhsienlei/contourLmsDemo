'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

/**
 * Runs one API request at a time: toast on success/failure, refresh server data on success.
 * Resolves true on success so callers can close dialogs or navigate.
 */
export function useApiAction() {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const inFlight = useRef(false)

  async function run(
    request: () => Promise<unknown>,
    successMessage: string,
    onSuccess?: () => void,
  ): Promise<boolean> {
    if (inFlight.current) return false
    inFlight.current = true
    setPending(true)
    try {
      await request()
      toast.success(successMessage)
      onSuccess?.()
      router.refresh()
      return true
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
      return false
    } finally {
      inFlight.current = false
      setPending(false)
    }
  }

  return { pending, run }
}
