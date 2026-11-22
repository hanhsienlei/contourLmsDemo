import { redirect } from 'next/navigation'
import { errors } from '@/lib/api/http'
import { getVerifiedUserId } from '@/lib/auth/session'
import { getRole, homeFor, type AppRole } from '@/lib/auth/roles'

export async function requireUser(): Promise<{ userId: string }> {
  const userId = await getVerifiedUserId()
  if (!userId) throw errors.unauthenticated()
  return { userId }
}

export async function requireRole(role: AppRole): Promise<{ userId: string; role: AppRole }> {
  const { userId } = await requireUser()
  const actual = await getRole(userId)
  if (actual !== role) throw errors.forbidden()
  return { userId, role }
}

export async function requireRolePage(role: AppRole): Promise<{ userId: string }> {
  const userId = await getVerifiedUserId()
  if (!userId) redirect('/auth/login')
  const actual = await getRole(userId)
  if (actual !== role) redirect(homeFor(actual))
  return { userId }
}
