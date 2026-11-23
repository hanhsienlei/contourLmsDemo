import { createClient } from '@/lib/supabase/server'
import { LogoutButton } from '@/components/logout-button'

export async function AppHeader() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const email = typeof data?.claims?.email === 'string' ? data.claims.email : null

  return (
    <header className="w-full border-b border-b-foreground/10">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-5 text-sm">
        <span className="font-semibold">Contour Consultations</span>
        <div className="flex items-center gap-4">
          {email && <span className="text-muted-foreground">{email}</span>}
          <LogoutButton />
        </div>
      </div>
    </header>
  )
}
