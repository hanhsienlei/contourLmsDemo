import { NextResponse } from 'next/server'
import { assertSameOrigin, handle, parseJson } from '@/lib/api/http'
import { requireRole } from '@/lib/auth/guards'
import { createConsultationSchema } from '@/lib/consultations/schema'
import { book, listOwn } from '@/lib/consultations/service'

export const GET = handle(async (_req: Request) => {
  const { userId } = await requireRole('student')
  return NextResponse.json({ items: await listOwn(userId) })
})

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req)
  const { userId } = await requireRole('student')
  const input = await parseJson(req, createConsultationSchema)
  return NextResponse.json({ item: await book(userId, input) }, { status: 201 })
})
