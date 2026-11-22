import { NextResponse } from 'next/server'
import { errors, handle } from '@/lib/api/http'
import { requireRole } from '@/lib/auth/guards'
import { adminListQuerySchema, decodeCursor } from '@/lib/consultations/schema'
import { listAll } from '@/lib/consultations/service'

export const GET = handle(async (req: Request) => {
  await requireRole('admin')
  const sp = new URL(req.url).searchParams
  const raw = { cursor: sp.get('cursor') ?? undefined, limit: sp.get('limit') ?? undefined }
  const q = adminListQuerySchema.parse(raw)
  let cursor
  if (q.cursor !== undefined) {
    cursor = decodeCursor(q.cursor) ?? undefined
    if (!cursor) throw errors.validation('Invalid cursor')
  }
  return NextResponse.json(await listAll({ cursor, limit: q.limit }))
})
