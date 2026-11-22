import { NextResponse } from 'next/server'
import { assertSameOrigin, handle, parseJson, parseRouteId } from '@/lib/api/http'
import { requireRole } from '@/lib/auth/guards'
import { updateConsultationSchema } from '@/lib/consultations/schema'
import { reschedule, setCompleted } from '@/lib/consultations/service'

export const PATCH = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req)
  const { userId } = await requireRole('student')
  const id = parseRouteId((await ctx.params).id)
  const body = await parseJson(req, updateConsultationSchema)
  const item =
    'scheduledAt' in body
      ? await reschedule(userId, id, body.scheduledAt)
      : await setCompleted(userId, id, body.completed)
  return NextResponse.json({ item })
})
