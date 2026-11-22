'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ApiClientError } from '@/lib/api/client'

/**
 * Runs one API request at a time: toast on success/failure, refresh server data on success.
 * Callers react to success (close a dialog, navigate) through `onSuccess`.
 * `conflictHint` is shown under the server message when the API answers 409.
 */
export function useApiAction() {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const inFlight = useRef(false)

  async function run(
    request: () => Promise<unknown>,
    successMessage: string,
    onSuccess?: () => void,
    opts?: { conflictHint?: string },
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
      const conflict = err instanceof ApiClientError && err.status === 409
      toast.error(err instanceof Error ? err.message : 'Something went wrong', {
        description: conflict ? opts?.conflictHint : undefined,
      })
    } finally {
      inFlight.current = false
      setPending(false)
    }
  }

  return { pending, run }
}
