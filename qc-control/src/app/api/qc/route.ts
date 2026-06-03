import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { evaluateWestgard } from '@/lib/westgard'
import { createQcRunSchema } from '@/lib/validators'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const lotId = searchParams.get('lotId')
  const limit = parseInt(searchParams.get('limit') || '20')

  const where = lotId ? { lotId } : {}
  const runs = await prisma.qcRun.findMany({
    where,
    orderBy: { runAt: 'desc' },
    take: limit,
    include: {
      lot: { include: { analyzer: true } },
      operator: { select: { name: true } },
    },
  })

  return NextResponse.json({ success: true, data: runs })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const body = await req.json()
  const parsed = createQcRunSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: { code: 'VALIDATION', message: parsed.error.message } }, { status: 400 })

  const lot = await prisma.lot.findUnique({ where: { id: parsed.data.lotId } })
  if (!lot) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Lot not found' } }, { status: 404 })

  const history = await prisma.qcRun.findMany({
    where: { lotId: lot.id },
    orderBy: { runAt: 'desc' },
    take: 20,
    select: { value: true, sdDistance: true, runAt: true },
  })

  const mean = Number(lot.targetMean)
  const sd = Number(lot.sd)
  const value = parsed.data.value

  const westgard = evaluateWestgard(
    value,
    mean,
    sd,
    history.map(h => ({ value: Number(h.value), sdDistance: Number(h.sdDistance), runAt: h.runAt }))
  )

  const run = await prisma.qcRun.create({
    data: {
      lotId: lot.id,
      value,
      sdDistance: westgard.sdDistance,
      ruleViolated: westgard.rule,
      isReject: westgard.isReject,
      isWarning: westgard.isWarning,
      status: westgard.rule && !westgard.isWarning ? 'PENDING_JUSTIFICATION' : 'RELEASED',
      operatorId: session.user.id,
      runAt: new Date(),
    },
    include: {
      lot: { include: { analyzer: true } },
      operator: { select: { name: true } },
    },
  })

  return NextResponse.json({ success: true, data: run, violation: westgard }, { status: 201 })
}
