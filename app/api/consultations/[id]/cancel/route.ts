import { NextResponse } from 'next/server'
import { assertSameOrigin, errors, handle } from '@/lib/api/http'
import { requireRole } from '@/lib/auth/guards'
import { idSchema } from '@/lib/consultations/schema'
import { cancel } from '@/lib/consultations/service'

export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req)
  const { userId } = await requireRole('student')
  const parsedId = idSchema.safeParse((await ctx.params).id)
  if (!parsedId.success) throw errors.validation('Invalid id')
  return NextResponse.json({ item: await cancel(userId, parsedId.data) })
})
