import { NextResponse } from 'next/server'
import { assertSameOrigin, errors, handle, parseJson } from '@/lib/api/http'
import { requireRole } from '@/lib/auth/guards'
import { idSchema, updateConsultationSchema } from '@/lib/consultations/schema'
import { reschedule, setCompleted } from '@/lib/consultations/service'

export const PATCH = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req)
  const { userId } = await requireRole('student')
  const parsedId = idSchema.safeParse((await ctx.params).id)
  if (!parsedId.success) throw errors.validation('Invalid id')
  const body = await parseJson(req, updateConsultationSchema)
  const item =
    'scheduledAt' in body
      ? await reschedule(userId, parsedId.data, body.scheduledAt)
      : await setCompleted(userId, parsedId.data, body.completed)
  return NextResponse.json({ item })
})
