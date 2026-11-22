import { NextResponse } from 'next/server'
import { assertSameOrigin, handle, parseRouteId } from '@/lib/api/http'
import { requireRole } from '@/lib/auth/guards'
import { cancel } from '@/lib/consultations/service'

export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req)
  const { userId } = await requireRole('student')
  const id = parseRouteId((await ctx.params).id)
  return NextResponse.json({ item: await cancel(userId, id) })
})
