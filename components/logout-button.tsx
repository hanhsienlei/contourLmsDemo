'use client'

import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

export function LogoutButton() {
  const router = useRouter()

  const logout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    // Replace, then drop the router cache so Back can't show a signed-in page.
    router.replace('/auth/login')
    router.refresh()
  }

  return <Button onClick={logout}>Logout</Button>
}
