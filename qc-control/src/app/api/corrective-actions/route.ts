import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createCASchema } from '@/lib/validators'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')

  const where = status ? { status: status as import('@prisma/client').CAStatus } : {}

  const actions = await prisma.correctiveAction.findMany({
    where,
    orderBy: { openedAt: 'desc' },
    include: {
      operator: { select: { id: true, name: true } },
      investigator: { select: { id: true, name: true } },
      verifiedBy: { select: { id: true, name: true } },
      lot: { select: { id: true, lotNumber: true, analyte: true } },
    },
  })

  return NextResponse.json({ success: true, data: actions })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const body = await req.json()
  const parsed = createCASchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: { code: 'VALIDATION', message: parsed.error.message } }, { status: 400 })

  const year = new Date().getFullYear()
  const lastCA = await prisma.correctiveAction.findFirst({
    where: { caNumber: { startsWith: `CA-${year}-` } },
    orderBy: { caNumber: 'desc' },
    select: { caNumber: true },
  })

  const nextSeq = lastCA ? parseInt(lastCA.caNumber.split('-')[2] || '0') + 1 : 1
  const caNumber = `CA-${year}-${String(nextSeq).padStart(4, '0')}`

  const action = await prisma.correctiveAction.create({
    data: {
      caNumber,
      openedAt: new Date(),
      analyte: parsed.data.analyte,
      lotId: parsed.data.lotId,
      equipmentId: parsed.data.equipmentId,
      ruleViolated: parsed.data.ruleViolated,
      operatorId: parsed.data.operatorId,
      investigatorId: parsed.data.investigatorId,
      targetCompletionAt: parsed.data.targetCompletionAt ? new Date(parsed.data.targetCompletionAt) : undefined,
    },
    include: {
      operator: { select: { id: true, name: true } },
      lot: { select: { id: true, lotNumber: true, analyte: true } },
    },
  })

  return NextResponse.json({ success: true, data: action }, { status: 201 })
}
