import { redirect } from 'next/navigation'
import { getVerifiedUserId } from '@/lib/auth/session'
import { getRole, homeFor } from '@/lib/auth/roles'

export default async function Home() {
  const userId = await getVerifiedUserId()
  if (!userId) redirect('/auth/login')
  redirect(homeFor(await getRole(userId)))
}
