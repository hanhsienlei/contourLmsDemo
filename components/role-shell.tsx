import { AppHeader } from '@/components/app-header'
import { requireRolePage } from '@/lib/auth/guards'
import type { AppRole } from '@/lib/auth/roles'

export async function RoleShell({ role, children }: { role: AppRole; children: React.ReactNode }) {
  await requireRolePage(role)
  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 p-5">{children}</main>
    </div>
  )
}
