import { NextResponse } from 'next/server'
import { assertSameOrigin, errors, handle, parseJson } from '@/lib/api/http'
import { requireRole } from '@/lib/auth/guards'
import { createConsultationSchema, parseStudentListQuery } from '@/lib/consultations/schema'
import { book, listOwnGroup } from '@/lib/consultations/service'

export const GET = handle(async (req: Request) => {
  const { userId } = await requireRole('student')
  const raw = Object.fromEntries(new URL(req.url).searchParams)
  const q = parseStudentListQuery(raw)
  if (!q) throw errors.validation('Invalid group, cursor or limit')
  return NextResponse.json(await listOwnGroup(userId, q))
})

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req)
  const { userId } = await requireRole('student')
  const input = await parseJson(req, createConsultationSchema)
  return NextResponse.json({ item: await book(userId, input) }, { status: 201 })
})
