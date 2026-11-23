import { NextResponse } from 'next/server'
import { errors, handle } from '@/lib/api/http'
import { requireRole } from '@/lib/auth/guards'
import { parseAdminListQuery } from '@/lib/consultations/schema'
import { listAll, listAllGroup } from '@/lib/consultations/service'

export const GET = handle(async (req: Request) => {
  await requireRole('admin')
  const sp = new URL(req.url).searchParams
  const q = parseAdminListQuery(Object.fromEntries(sp))
  if (!q) throw errors.validation('Invalid group, cursor or limit')
  // Without a group the list is every booking, as before; with one it is that tab, with its total.
  const { group, ...page } = q
  return NextResponse.json(group ? await listAllGroup({ group, ...page }) : await listAll(page))
})
