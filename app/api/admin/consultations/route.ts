import { NextResponse } from 'next/server'
import { errors, handle } from '@/lib/api/http'
import { requireRole } from '@/lib/auth/guards'
import { parseAdminListQuery } from '@/lib/consultations/schema'
import { listAll } from '@/lib/consultations/service'

export const GET = handle(async (req: Request) => {
  await requireRole('admin')
  const sp = new URL(req.url).searchParams
  const raw = { cursor: sp.get('cursor') ?? undefined, limit: sp.get('limit') ?? undefined }
  const q = parseAdminListQuery(raw)
  if (!q) throw errors.validation('Invalid cursor or limit')
  return NextResponse.json(await listAll(q))
})
